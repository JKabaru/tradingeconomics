

import type { Configuration, Tick, BacktestTickResult, ForecastResult, JudgeResult, BacktestResults, ModelBenchmark, ExcludedModel } from '../types';
import { generateJsonContent } from './geminiService';
import { PARTICIPATION_THRESHOLD } from '../constants';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const buildForecastPrompt = (
    basePrompt: string,
    currentTick: Tick,
    nextTickDate: string,
    pastFeedback: string[],
    feedbackLimit: number
): string => {
    let prompt = basePrompt;
    const peerData = currentTick.peers
        .map(p => `- ${p.title}: ${p.value} (${p.unit})`)
        .join('\n');
    
    const feedbackText = pastFeedback.length > 0 
        ? pastFeedback.map((fb, i) => `Feedback ${i+1}: ${fb}`).join('\n')
        : "None (first tick)";

    prompt = prompt.replace(/\[COUNTRY\]/g, currentTick.country);
    prompt = prompt.replace(/\[INDICATOR\]/g, currentTick.indicator);
    prompt = prompt.replace(/\[CURRENT_DATE\]/g, new Date(currentTick.date).toLocaleDateString());
    prompt = prompt.replace(/\[CURRENT_VALUE\]/g, String(currentTick.primary.value));
    prompt = prompt.replace(/\[CURRENT_UNIT\]/g, currentTick.primary.unit);
    prompt = prompt.replace(/\[PEER_DATA\]/g, peerData);
    prompt = prompt.replace(/\[FEEDBACK_LIMIT\]/g, String(feedbackLimit));
    prompt = prompt.replace(/\[PAST_FEEDBACK or "None \(first tick\)"\]/g, feedbackText);
    prompt = prompt.replace(/\[PAST_FEEDBACK\]/g, feedbackText);
    prompt = prompt.replace(/\[NEXT_DATE\]/g, new Date(nextTickDate).toLocaleDateString());
    
    return prompt;
};

const buildJudgePrompt = (
    basePrompt: string,
    modelName: string,
    tickIndex: number,
    tick: Tick,
    nextTickDate: string,
    forecast: ForecastResult,
    actualValue: number,
    pastPerformance: { prediction: number; actual: number; error: number }[],
    feedbackLimit: number
): string => {
    let prompt = basePrompt;
    const performanceText = pastPerformance.length > 0
        ? pastPerformance.map((p, i) => `Tick ${tickIndex - pastPerformance.length + i}: Prediction: ${p.prediction}, Actual: ${p.actual}, Error: ${p.error.toFixed(2)}`).join('\n')
        : "None (first tick)";

    prompt = prompt.replace(/\[MODEL_NAME\]/g, modelName);
    prompt = prompt.replace(/\[TICK_INDEX\]/g, String(tickIndex));
    prompt = prompt.replace(/\[INDICATOR\]/g, tick.indicator);
    prompt = prompt.replace(/\[COUNTRY\]/g, tick.country);
    prompt = prompt.replace(/\[NEXT_DATE\]/g, new Date(nextTickDate).toLocaleDateString());
    prompt = prompt.replace(/\[PREDICTION\]/g, String(forecast.prediction));
    prompt = prompt.replace(/\[UNIT\]/g, forecast.unit);
    prompt = prompt.replace(/\[ACTUAL_VALUE\]/g, String(actualValue));
    prompt = prompt.replace(/\[CONFIDENCE\]/g, String(forecast.confidence));
    prompt = prompt.replace(/\[FEEDBACK_LIMIT\]/g, String(feedbackLimit));
    prompt = prompt.replace(/\[PAST_PERFORMANCE\]/g, performanceText);

    return prompt;
};

const calculateAggregateScores = (
    ticks: Tick[],
    tickResults: BacktestTickResult[],
    allAttemptedModels: string[],
    errors: Record<string, string>
): BacktestResults => {
    const emptyResults: BacktestResults = {
        compositeScore: 0,
        overallDirectionalAccuracy: 0,
        overallMagnitudeRmse: 0,
        overallAvgConfidence: 0,
        topPerformers: [],
        excludedModels: [],
    };

    if (tickResults.length === 0) {
        // If there are no results, all models are excluded due to failure.
        emptyResults.excludedModels = allAttemptedModels.map(modelId => {
            const [provider, modelName] = modelId.split('::');
            return {
                modelId,
                modelName: modelName || modelId,
                provider,
                reason: 'Failed',
                message: errors[modelName] || 'No successful predictions were generated.',
                predictions: 0,
                totalTicks: ticks.length - 1
            };
        });
        return emptyResults;
    }

    const totalPossibleTicks = ticks.length - 1;

    // 1. Aggregate raw data per model
    const statsByModel: Record<string, {
        predictions: number[],
        confidences: number[],
        actuals: number[],
        prevActuals: number[],
    }> = {};

    allAttemptedModels.forEach(modelId => {
        statsByModel[modelId] = { predictions: [], confidences: [], actuals: [], prevActuals: [] };
    });

    for (let i = 0; i < tickResults.length; i++) {
        const result = tickResults[i];
        const prevActual = ticks[i].primary.value;
        const currentActual = ticks[i + 1]?.primary.value;

        if (prevActual === null || currentActual === null || currentActual === undefined) continue;

        Object.entries(result.forecasts).forEach(([modelId, forecast]) => {
            if (statsByModel[modelId]) {
                statsByModel[modelId].predictions.push(forecast.prediction);
                statsByModel[modelId].confidences.push(forecast.confidence);
                statsByModel[modelId].actuals.push(currentActual);
                statsByModel[modelId].prevActuals.push(prevActual);
            }
        });
    }

    // 2. Calculate advanced metrics for each model
    const allActualValues = Object.values(statsByModel).flatMap(s => s.actuals);
    const minActual = Math.min(...allActualValues);
    const maxActual = Math.max(...allActualValues);
    const actualsRange = maxActual - minActual;

    const benchmarks: ModelBenchmark[] = [];

    for (const modelId of allAttemptedModels) {
        const stats = statsByModel[modelId];
        const n = stats.predictions.length;
        if (n === 0) continue; // Will be handled as an excluded model later

        let correctDirections = 0;
        let squaredErrorSum = 0;
        let brierScoreSum = 0;

        for (let i = 0; i < n; i++) {
            const pred = stats.predictions[i];
            const actual = stats.actuals[i];
            const prevActual = stats.prevActuals[i];
            const confidence = stats.confidences[i];

            const predictedDirection = Math.sign(pred - prevActual);
            const actualDirection = Math.sign(actual - prevActual);

            const outcome = (predictedDirection === actualDirection || (actualDirection === 0 && predictedDirection === 0)) ? 1 : 0;
            if (outcome === 1) correctDirections++;
            
            squaredErrorSum += Math.pow(actual - pred, 2);
            brierScoreSum += Math.pow(confidence - outcome, 2);
        }

        const directionalAccuracy = (correctDirections / n) * 100;
        const rmse = Math.sqrt(squaredErrorSum / n);
        const brierScore = brierScoreSum / n;
        const avgConfidence = stats.confidences.reduce((a, b) => a + b, 0) / n * 100;

        // Calculate Composite Score
        const normDirAcc = directionalAccuracy / 100;
        const normRmse = actualsRange > 0 ? 1 - Math.min(1, rmse / actualsRange) : 0;
        const normConfidence = avgConfidence / 100;
        
        const compositeScore = (
            0.4 * normDirAcc +
            0.3 * normRmse +
            0.2 * normConfidence +
            0.1 * (1 - brierScore)
        ) * 100;
        
        const [provider, modelName] = modelId.split('::');
        benchmarks.push({
            modelId,
            modelName,
            provider,
            completionRate: (n / totalPossibleTicks) * 100,
            directionalAccuracy,
            rmse,
            brierScore,
            avgConfidence,
            compositeScore,
            predictions: n,
        });
    }
    
    // 3. Filter into top performers and excluded models
    const topPerformers: ModelBenchmark[] = [];
    const excludedModels: ExcludedModel[] = [];

    benchmarks.forEach(bench => {
        if (bench.completionRate < PARTICIPATION_THRESHOLD) {
            excludedModels.push({
                ...bench,
                reason: 'Insufficient Coverage',
                totalTicks: totalPossibleTicks,
            });
        } else {
            topPerformers.push(bench);
        }
    });
    
    // Add models that failed completely
    const benchmarkedModels = new Set(benchmarks.map(b => b.modelId));
    allAttemptedModels.forEach(modelId => {
        if (!benchmarkedModels.has(modelId)) {
            const [provider, modelName] = modelId.split('::');
             excludedModels.push({
                modelId, modelName, provider,
                reason: 'Failed',
                message: errors[modelName] || 'Model failed to produce any valid output.',
                predictions: 0,
                totalTicks: totalPossibleTicks
            });
        }
    });

    topPerformers.sort((a, b) => b.compositeScore - a.compositeScore);

    // 4. Calculate overall scores from top performers for the stat cards
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    
    if (topPerformers.length === 0) return { ...emptyResults, excludedModels };

    return {
        compositeScore: avg(topPerformers.map(p => p.compositeScore)),
        overallDirectionalAccuracy: avg(topPerformers.map(p => p.directionalAccuracy)),
        overallMagnitudeRmse: avg(topPerformers.map(p => p.rmse)),
        overallAvgConfidence: avg(topPerformers.map(p => p.avgConfidence)),
        topPerformers,
        excludedModels,
    };
};

const getForecastWithRetries = async (prompt: string, modelId: string, apiKeys: Record<string, string>): Promise<ForecastResult> => {
    let attempts = 0;
    const maxRetries = 3;
    while (attempts < maxRetries) {
        try {
            return await generateJsonContent(prompt, modelId, apiKeys);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
            const isRetryable = errorMessage.includes("rate limit") || errorMessage.includes("500") || errorMessage.includes("502") || errorMessage.includes("503") || errorMessage.includes("504") || errorMessage.includes("overloaded");

            if (isRetryable && attempts < maxRetries - 1) {
                attempts++;
                const delay = Math.pow(2, attempts) * 1000 + Math.random() * 1000;
                console.warn(`Retryable error for ${modelId}. Retrying in ${Math.round(delay/1000)}s... (Attempt ${attempts}/${maxRetries-1})`);
                await sleep(delay);
            } else {
                throw error; // Re-throw other errors or on final attempt
            }
        }
    }
    // This should ideally not be reached, but typescript needs a return path.
    throw new Error(`Max retries exceeded for ${modelId}`);
};

export const runBacktest = async (
    config: Configuration,
    ticks: Tick[],
    apiKeys: Record<string, string>,
): Promise<{ results: BacktestResults; tickResults: BacktestTickResult[] }> => {

    const forecasterModels = Object.entries(config.llmSelections).flatMap(([provider, models]) =>
        models.map(model => `${provider}::${model}`)
    );
    const { judgeModel, forecastPrompt, judgePrompt, feedbackLimit } = config;
    
    if (!judgeModel) throw new Error("A judge model must be selected to run a backtest.");
    if (forecasterModels.length === 0) throw new Error("At least one forecaster model must be selected.");
    if (ticks.length < 2) throw new Error("At least two data ticks are required to run a backtest.");

    const modelFeedbackHistory: Record<string, string[]> = {};
    const modelPerformanceHistory: Record<string, { prediction: number; actual: number; error: number }[]> = {};
    const tickResults: BacktestTickResult[] = [];
    const persistentModelErrors: Record<string, string> = {};

    forecasterModels.forEach(modelId => {
        modelFeedbackHistory[modelId] = [];
        modelPerformanceHistory[modelId] = [];
    });

    const maxTicksToProcess = Math.min(ticks.length - 1, config.simulationOptions.maxPredictions);

    for (let i = 0; i < maxTicksToProcess; i++) {
        const currentTick = ticks[i];
        const nextTick = ticks[i + 1];
        
        // Safeguard to ensure we don't try to process beyond the available data.
        if (!nextTick) {
            break;
        }

        const tickForecasts: Record<string, ForecastResult> = {};
        const tickEvaluations: Record<string, JudgeResult> = {};

        // --- Forecast Step (Parallel Execution) ---
        const forecastPromises = forecasterModels.map(modelId => {
            if (persistentModelErrors[modelId]) {
                // If a model has a permanent error, don't try again.
                return Promise.resolve({ status: 'skipped' as const, modelId });
            }
            const pastFeedback = modelFeedbackHistory[modelId].slice(-feedbackLimit);
            const prompt = buildForecastPrompt(forecastPrompt, currentTick, nextTick.date, pastFeedback, feedbackLimit);
            
            return getForecastWithRetries(prompt, modelId, apiKeys)
                .then(result => ({ status: 'fulfilled' as const, value: result, modelId }))
                .catch(error => ({ status: 'rejected' as const, reason: error, modelId }));
        });
        
        const forecastSettledResults = await Promise.all(forecastPromises);

        for (const result of forecastSettledResults) {
            if (result.status === 'fulfilled') {
                tickForecasts[result.modelId] = result.value;
            } else if (result.status === 'rejected') {
                const errorMessage = result.reason instanceof Error ? result.reason.message : 'Unknown forecast error';
                console.error(`Forecast permanently failed for ${result.modelId} on tick ${i}:`, errorMessage);
                // Record the first permanent error for the final report.
                if (!persistentModelErrors[result.modelId]) {
                    persistentModelErrors[result.modelId] = errorMessage.replace(`[${result.modelId.split('::')[1]}]`, '').trim();
                }
            }
        }

        // --- Evaluation Step (Parallel Execution) ---
        if (nextTick.primary.value === null) {
            console.log(`Ending backtest loop at tick ${i}: The next data point has no 'actual' value to evaluate against.`);
            break;
        }
        const actualValue = nextTick.primary.value;
        const successfulForecasts = Object.entries(tickForecasts);
        
        const evaluationPromises = successfulForecasts.map(([modelId, forecast]) => {
            const pastPerformance = modelPerformanceHistory[modelId].slice(-feedbackLimit);
            const prompt = buildJudgePrompt(judgePrompt, modelId, i + 1, currentTick, nextTick.date, forecast, actualValue, pastPerformance, feedbackLimit);
            
            // Judge failures are critical and not retried to avoid cascading delays
            return generateJsonContent(prompt, judgeModel, apiKeys)
                .then(result => ({ status: 'fulfilled' as const, value: result, modelId }))
                .catch(error => ({ status: 'rejected' as const, reason: error, modelId }));
        });

        const evaluationSettledResults = await Promise.all(evaluationPromises);

        for (const result of evaluationSettledResults) {
             if (result.status === 'fulfilled') {
                tickEvaluations[result.modelId] = result.value;
                
                // Store history for the next iteration for this successful model
                modelFeedbackHistory[result.modelId].push(result.value.feedback);
                modelPerformanceHistory[result.modelId].push({
                    prediction: successfulForecasts.find(([mid]) => mid === result.modelId)![1].prediction,
                    actual: actualValue,
                    error: result.value.error,
                });

            } else if (result.status === 'rejected') {
                const errorMessage = result.reason instanceof Error ? result.reason.message : 'Unknown evaluation error';
                 console.error(`Evaluation failed for ${result.modelId} on tick ${i} (Judge: ${judgeModel}):`, errorMessage);
                // If judge fails, we can't continue for this model. Mark it as a persistent error.
                 if (!persistentModelErrors[result.modelId]) {
                    persistentModelErrors[result.modelId] = `Evaluation failed: ${errorMessage}`;
                }
            }
        }
        
        // Only add a tick result if at least one model was successfully forecasted and evaluated.
        if (Object.keys(tickEvaluations).length > 0) {
             tickResults.push({
                tickIndex: i,
                tickData: currentTick,
                forecasts: tickForecasts,
                evaluations: tickEvaluations,
            });
        }
    }

    // Format error keys for display
    const formattedErrors: Record<string, string> = {};
    Object.entries(persistentModelErrors).forEach(([modelId, message]) => {
        formattedErrors[modelId.split('::')[1]] = message;
    });

    const results = calculateAggregateScores(ticks, tickResults, forecasterModels, formattedErrors);

    return { results, tickResults };
};
