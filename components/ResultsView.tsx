

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Run, Tick, VerificationResult, BacktestTickResult, ForecastResult, JudgeResult, ExcludedModel, ModelBenchmark } from '../types';
import { ChartComponent } from './ChartComponent';
import { DocumentTextIcon, ChartBarIcon, TrophyIcon, DocumentMagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon, BeakerIcon, ChatBubbleLeftRightIcon, CheckCircleIcon, XCircleIcon, ArrowUpIcon, ArrowDownIcon, WarningIcon, InformationCircleIcon, ScaleIcon, ChevronUpDownIcon, ArrowDownTrayIcon } from './IconComponents';
// FIX: Add CartesianGrid to recharts import to fix "Cannot find name 'CartesianGrid'" error.
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer as RechartsResponsiveContainer } from 'recharts';


interface ResultsViewProps {
  run: Run;
}

const LoadingState: React.FC = () => (
    <div className="flex flex-col items-center justify-center p-12 bg-theme-surface rounded-lg border border-theme-border text-center">
        <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
        <h3 className="text-2xl font-bold text-white mt-6">Running Backtest...</h3>
        <p className="text-theme-text-secondary mt-2">Generating and evaluating predictions. This may take a few moments.</p>
    </div>
);

const StatCard: React.FC<{ title: string; value: string; tooltip?: string }> = ({ title, value, tooltip }) => (
  <div className="bg-theme-surface p-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300 border border-theme-border">
    <div className="flex items-center">
      <p className="text-sm text-theme-text-secondary">{title}</p>
      {tooltip && (
        <div className="relative group ml-2">
          <InformationCircleIcon className="w-4 h-4 text-gray-500" />
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-2 bg-black text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {tooltip}
          </div>
        </div>
      )}
    </div>
    <p className="text-4xl font-bold text-white mt-2">{value}</p>
  </div>
);

const ExcludedModelsReport: React.FC<{ excludedModels: ExcludedModel[] }> = ({ excludedModels }) => {
    if (!excludedModels || excludedModels.length === 0) return null;

    return (
        <div className="bg-yellow-900/20 border border-yellow-700 text-yellow-300 p-4 sm:p-6 rounded-lg">
            <div className="flex items-start">
                <WarningIcon className="w-6 h-6 text-yellow-400 mr-4 flex-shrink-0 mt-1"/>
                <div>
                    <h3 className="text-xl font-bold text-white">Excluded Models Report</h3>
                    <p className="mt-1">
                        {excludedModels.length} model(s) were excluded from the final leaderboard for the following reasons.
                    </p>
                    <div className="text-sm space-y-2 mt-4 bg-black/20 p-3 rounded-md">
                       <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-yellow-600/50">
                                    <th className="text-left font-semibold p-2">Model</th>
                                    <th className="text-left font-semibold p-2">Reason</th>
                                    <th className="text-left font-semibold p-2">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                            {excludedModels.map((model) => (
                                <tr key={model.modelId} className="border-t border-yellow-600/20">
                                    <td className="p-2 font-semibold text-white break-all">{model.modelName}</td>
                                    <td className="p-2 font-medium">{model.reason}</td>
                                    <td className="p-2 font-mono text-xs">
                                        {model.reason === 'Failed' 
                                            ? model.message 
                                            : `Completed ${model.predictions}/${model.totalTicks} ticks.`}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                       </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
};

const LeaderboardTab: React.FC<{ run: Run }> = ({ run }) => {
    const { results } = run;
    const [searchTerm, setSearchTerm] = useState('');
    const [providerFilter, setProviderFilter] = useState('All');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ModelBenchmark | 'modelName'; direction: 'asc' | 'desc' }>({ key: 'compositeScore', direction: 'desc' });
    
    const providerOptions = useMemo(() => ['All', ...new Set(results.topPerformers.map(p => p.provider))], [results.topPerformers]);

    const sortedAndFilteredData = useMemo(() => {
        let data = [...results.topPerformers];

        if (providerFilter !== 'All') {
            data = data.filter(model => model.provider === providerFilter);
        }

        if (searchTerm) {
            data = data.filter(model => model.modelName.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        data.sort((a, b) => {
            const key = sortConfig.key as keyof ModelBenchmark;
            let aValue = a[key];
            let bValue = b[key];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }
            
            aValue = a[key] as number;
            bValue = b[key] as number;
            
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }, [results.topPerformers, searchTerm, providerFilter, sortConfig]);

    const handleSort = (key: keyof ModelBenchmark | 'modelName') => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };
    
    const SortableHeader: React.FC<{ sortKey: keyof ModelBenchmark | 'modelName'; children: React.ReactNode; className?: string }> = ({ sortKey, children, className = '' }) => {
        const isSorted = sortConfig.key === sortKey;
        const Icon = isSorted ? (sortConfig.direction === 'asc' ? ArrowUpIcon : ArrowDownIcon) : ChevronUpDownIcon;

        return (
            <th className={`p-3 font-semibold text-theme-text-secondary text-sm cursor-pointer hover:text-white transition-colors ${className}`} onClick={() => handleSort(sortKey)}>
                <div className="flex items-center">
                    {children}
                    <Icon className={`w-4 h-4 ml-1.5 flex-shrink-0 ${isSorted ? 'text-white' : 'text-gray-500'}`} />
                </div>
            </th>
        );
    };

    return (
        <div className="space-y-8">
            <ExcludedModelsReport excludedModels={results.excludedModels} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Avg. Composite Score" value={results.compositeScore.toFixed(2)} tooltip="A weighted score across all metrics for top-performing models. Higher is better." />
                <StatCard title="Avg. Directional Accuracy" value={`${results.overallDirectionalAccuracy.toFixed(2)}%`} tooltip="Average percentage of times models correctly predicted the direction of change (up/down)." />
                <StatCard title="Avg. Magnitude RMSE" value={`${results.overallMagnitudeRmse.toFixed(3)}`} tooltip="Average Root Mean Square Error. Measures the magnitude of prediction errors. Lower is better."/>
                <StatCard title="Avg. Confidence" value={`${results.overallAvgConfidence.toFixed(2)}%`} tooltip="Average confidence score reported by models across their successful predictions." />
            </div>

            <div className="bg-theme-surface p-4 sm:p-6 rounded-lg border border-theme-border">
                <h3 className="text-xl font-bold text-white mb-4">Top Performing Models</h3>
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <input
                        type="text"
                        placeholder="Search models..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full sm:w-1/2 bg-gray-800 text-white px-3 py-2 rounded-md border border-theme-border focus:outline-none focus:ring-1 focus:ring-theme-accent"
                    />
                    <select
                        value={providerFilter}
                        onChange={e => setProviderFilter(e.target.value)}
                         className="w-full sm:w-auto bg-gray-800 text-white px-3 py-2 rounded-md border border-theme-border focus:outline-none focus:ring-1 focus:ring-theme-accent"
                    >
                        {providerOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                        <thead>
                            <tr className="border-b border-theme-border">
                                <SortableHeader sortKey="modelName">Model</SortableHeader>
                                <SortableHeader sortKey="completionRate" className="text-right">Coverage</SortableHeader>
                                <SortableHeader sortKey="directionalAccuracy" className="text-right">Dir. Accuracy</SortableHeader>
                                <SortableHeader sortKey="rmse" className="text-right">RMSE</SortableHeader>
                                <SortableHeader sortKey="brierScore" className="text-right">Brier Score</SortableHeader>
                                <SortableHeader sortKey="compositeScore" className="text-right">Composite</SortableHeader>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedAndFilteredData.map((row, index) => (
                                <tr key={row.modelId} className="border-b border-theme-border last:border-b-0 hover:bg-white/5 transition-colors">
                                    <td className="p-3">
                                        <div className="flex items-center">
                                            <span className={`font-bold text-lg mr-3 w-8 text-center ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-yellow-600' : 'text-theme-accent'}`}>#{index + 1}</span>
                                            <div>
                                                <div className="font-semibold text-white break-all">{row.modelName}</div>
                                                <div className="text-xs text-theme-text-secondary">{row.provider}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-3 font-mono text-theme-text-primary text-right">{row.completionRate.toFixed(1)}%</td>
                                    <td className="p-3 font-mono text-white text-right">{row.directionalAccuracy.toFixed(2)}%</td>
                                    <td className="p-3 font-mono text-theme-text-primary text-right">{row.rmse.toFixed(3)}</td>
                                    <td className="p-3 font-mono text-theme-text-primary text-right">{row.brierScore.toFixed(3)}</td>
                                    <td className="p-3 font-mono text-white font-bold text-right">{row.compositeScore.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const ModelComparisonTab: React.FC<{ run: Run }> = ({ run }) => {
    const { topPerformers } = run.results;
    const [selectedModels, setSelectedModels] = useState<string[]>(() => 
        topPerformers.slice(0, 3).map(m => m.modelId)
    );

    const handleModelSelection = (modelId: string) => {
        setSelectedModels(prev => 
            prev.includes(modelId)
                ? prev.filter(id => id !== modelId)
                : [...prev, modelId]
        );
    };

    const selectedModelsData = useMemo(() => 
        topPerformers.filter(m => selectedModels.includes(m.modelId)),
        [topPerformers, selectedModels]
    );

    const metrics = [
        { key: 'compositeScore', name: 'Composite Score', format: (v: number) => v.toFixed(2) },
        { key: 'directionalAccuracy', name: 'Dir. Accuracy (%)', format: (v: number) => v.toFixed(2) },
        { key: 'rmse', name: 'RMSE', format: (v: number) => v.toFixed(3) },
        { key: 'brierScore', name: 'Brier Score', format: (v: number) => v.toFixed(3) },
        { key: 'avgConfidence', name: 'Avg. Confidence (%)', format: (v: number) => v.toFixed(2) },
        { key: 'completionRate', name: 'Coverage (%)', format: (v: number) => v.toFixed(1) },
    ];

    const barChartData = useMemo(() => 
        metrics.map(metric => {
            const dataPoint: { metric: string, [modelName: string]: any } = { metric: metric.name };
            selectedModelsData.forEach(model => {
                dataPoint[model.modelName] = model[metric.key as keyof ModelBenchmark];
            });
            return dataPoint;
        }), 
    [selectedModelsData, metrics]);

    const lineChartData = useMemo(() => {
        if (!run.tickResults || !run.config.verificationData || selectedModels.length === 0) return [];
        
        const allTicks: Tick[] = [];
        Object.values(run.config.verificationData).forEach(result => {
            if ((result as VerificationResult).status === 'success' && (result as VerificationResult).tickData) {
                allTicks.push(...(result as VerificationResult).tickData!);
            }
        });
        allTicks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return allTicks.slice(1, run.tickResults.length + 1).map((tick, index) => {
            const tickResult = run.tickResults![index];
            if (!tickResult) return null;

            const dataPoint: { [key: string]: any } = {
                date: new Date(tick.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                Actual: tick.primary.value
            };

            selectedModels.forEach(modelId => {
                if (tickResult?.forecasts[modelId]) {
                    const modelName = topPerformers.find(m => m.modelId === modelId)?.modelName || modelId;
                    dataPoint[modelName] = tickResult?.forecasts[modelId]?.prediction;
                }
            });
            return dataPoint;
        }).filter(Boolean);
    }, [run, selectedModels, topPerformers]);

    const lineChartLines = useMemo(() => {
        if (selectedModels.length === 0) return [];
        const lines = [{ dataKey: 'Actual', color: '#E0E0E0' }];
        selectedModelsData.forEach(model => {
            lines.push({ dataKey: model.modelName, color: stringToColor(model.modelId) });
        });
        return lines;
    }, [selectedModelsData]);


    return (
        <div className="space-y-6">
            <div className="bg-theme-surface p-4 sm:p-6 rounded-lg border border-theme-border">
                <h3 className="text-lg font-bold text-white mb-3">Select Models to Compare</h3>
                <div className="flex flex-wrap gap-3">
                    {topPerformers.map(model => (
                        <label key={model.modelId} className={`flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all border-2 ${selectedModels.includes(model.modelId) ? 'bg-theme-accent/20 border-theme-accent' : 'bg-gray-800 border-transparent hover:border-theme-accent/50'}`}>
                            <input
                                type="checkbox"
                                checked={selectedModels.includes(model.modelId)}
                                onChange={() => handleModelSelection(model.modelId)}
                                className="form-checkbox h-5 w-5 bg-gray-700 border-gray-600 rounded text-theme-accent focus:ring-theme-accent"
                            />
                            <span className="ml-3 font-medium text-white">{model.modelName}</span>
                        </label>
                    ))}
                </div>
            </div>

            {selectedModelsData.length > 0 ? (
                <div className="space-y-6">
                    <div className="bg-theme-surface p-4 sm:p-6 rounded-lg border border-theme-border">
                        <h3 className="text-xl font-bold text-white mb-4">Metrics Overview</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-theme-border">
                                        <th className="p-3 font-semibold text-theme-text-secondary text-sm">Metric</th>
                                        {selectedModelsData.map(model => <th key={model.modelId} className="p-3 font-semibold text-white text-sm text-right">{model.modelName}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.map(metric => (
                                        <tr key={metric.key} className="border-b border-theme-border last:border-b-0">
                                            <td className="p-3 font-medium text-theme-text-primary">{metric.name}</td>
                                            {selectedModelsData.map(model => (
                                                <td key={model.modelId} className="p-3 font-mono text-white text-right">
                                                    {metric.format(model[metric.key as keyof ModelBenchmark] as number)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-theme-surface p-4 sm:p-6 rounded-lg border border-theme-border h-[400px]">
                        <h3 className="text-xl font-bold text-white mb-4">Metrics Comparison Chart</h3>
                        <RechartsResponsiveContainer width="100%" height="90%">
                            <BarChart data={barChartData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#424242" />
                                <XAxis type="number" stroke="#B0B0B0" />
                                <YAxis type="category" dataKey="metric" stroke="#B0B0B0" width={120} tick={{ fontSize: 12 }} />
                                <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #424242' }} cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}/>
                                <Legend />
                                {selectedModelsData.map(model => (
                                    <Bar key={model.modelId} dataKey={model.modelName} fill={stringToColor(model.modelId)} />
                                ))}
                            </BarChart>
                        </RechartsResponsiveContainer>
                    </div>

                    <ChartComponent data={lineChartData} lines={lineChartLines} />

                </div>
            ) : (
                <div className="text-center p-8 bg-theme-surface rounded-lg border border-theme-border">
                    <p className="text-theme-text-secondary">Please select at least one model to see a comparison.</p>
                </div>
            )}
        </div>
    );
};


const TickDataChartTab: React.FC<{ run: Run }> = ({ run }) => {
    const chartData = useMemo(() => {
        if (!run.tickResults || !run.config.verificationData) return [];

        const allTicks: Tick[] = [];
        Object.values(run.config.verificationData).forEach(result => {
            const verificationResult = result as VerificationResult;
            if (verificationResult.status === 'success' && verificationResult.tickData) {
                allTicks.push(...verificationResult.tickData);
            }
        });
        allTicks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (allTicks.length === 0 || run.tickResults.length === 0) return [];
        
        const forecasterModels = run.results.topPerformers.map(m => m.modelId);

        return allTicks.slice(1, run.tickResults.length + 1).map((tick, index) => {
            const tickResult = run.tickResults![index];
            if (!tickResult) return null;

            const dataPoint: { [key: string]: any } = {
                date: new Date(tick.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                Actual: tick.primary.value
            };

            forecasterModels.forEach(modelId => {
                if (tickResult?.forecasts[modelId]) {
                    dataPoint[run.results.topPerformers.find(m => m.modelId === modelId)?.modelName || modelId] = tickResult?.forecasts[modelId]?.prediction;
                }
            });

            return dataPoint;
        }).filter(Boolean);

    }, [run]);

    const chartLines = useMemo(() => {
        if (!run.results.topPerformers || run.results.topPerformers.length === 0) return [];
        
        const lines = [{ dataKey: 'Actual', color: '#E0E0E0' }];

        run.results.topPerformers.forEach((model) => {
            lines.push({
                dataKey: model.modelName,
                color: stringToColor(model.modelId)
            });
        });
        return lines;
    }, [run.results.topPerformers]);

    return <ChartComponent data={chartData} lines={chartLines} />;
};

const TickAnalyticsTab: React.FC<{ run: Run }> = ({ run }) => {
    const [selectedCountry, setSelectedCountry] = useState('All');
    const [selectedIndicator, setSelectedIndicator] = useState('All');
    const [selectedModel, setSelectedModel] = useState('All');
    const [currentTickIndex, setCurrentTickIndex] = useState(0);

    const availableCountries = useMemo(() => ['All', ...new Set(run.tickResults?.map(r => r.tickData.country) || run.config.countries)], [run.tickResults, run.config.countries]);
    const availableIndicators = useMemo(() => ['All', ...new Set(run.tickResults?.map(r => r.tickData.indicator) || run.config.indicators)], [run.tickResults, run.config.indicators]);
    
    const allModelsInRun = useMemo(() => {
        const modelSet = new Set<string>();
        run.tickResults?.forEach(tr => {
            Object.keys(tr.forecasts).forEach(modelId => modelSet.add(modelId));
        });
        return Array.from(modelSet);
    }, [run.tickResults]);

    const availableModels = useMemo(() => {
        const models = allModelsInRun.map(modelId => {
            const modelDetails = run.results.topPerformers.find(m => m.modelId === modelId) || run.results.excludedModels.find(m => m.modelId === modelId);
            return { id: modelId, name: modelDetails?.modelName || modelId.split('::')[1] || modelId };
        });
        models.sort((a,b) => a.name.localeCompare(b.name));
        return [{ id: 'All', name: 'All Models' }, ...models];
    }, [allModelsInRun, run.results]);

    const filteredTickResults = useMemo(() => {
        if (!run.tickResults) return [];
        return run.tickResults.filter(result => {
            const countryMatch = selectedCountry === 'All' || result.tickData.country === selectedCountry;
            const indicatorMatch = selectedIndicator === 'All' || result.tickData.indicator === selectedIndicator;
            const modelMatch = selectedModel === 'All' || Object.prototype.hasOwnProperty.call(result.forecasts, selectedModel);
            return countryMatch && indicatorMatch && modelMatch;
        });
    }, [run.tickResults, selectedCountry, selectedIndicator, selectedModel]);

    useEffect(() => {
        setCurrentTickIndex(0);
    }, [selectedCountry, selectedIndicator, selectedModel]);

    const totalFilteredTicks = filteredTickResults.length;
    const tickResult = filteredTickResults[currentTickIndex];
    
    const handleNext = () => setCurrentTickIndex(prev => Math.min(prev + 1, totalFilteredTicks - 1));
    const handlePrev = () => setCurrentTickIndex(prev => Math.max(prev - 1, 0));

    if (!run.tickResults || run.tickResults.length === 0) {
        return <p className="text-theme-text-secondary text-center p-8">No tick data available for analysis.</p>;
    }

    return (
        <div className="space-y-6">
            <div className="p-4 bg-black/20 rounded-lg border border-theme-border grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label htmlFor="country-filter" className="block text-sm font-medium text-theme-text-secondary mb-1">Country</label>
                    <select
                        id="country-filter"
                        value={selectedCountry}
                        onChange={e => setSelectedCountry(e.target.value)}
                        className="w-full bg-gray-800 text-white p-2 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent focus:border-theme-accent"
                    >
                        {availableCountries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="indicator-filter" className="block text-sm font-medium text-theme-text-secondary mb-1">Indicator</label>
                    <select
                        id="indicator-filter"
                        value={selectedIndicator}
                        onChange={e => setSelectedIndicator(e.target.value)}
                        className="w-full bg-gray-800 text-white p-2 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent focus:border-theme-accent"
                    >
                        {availableIndicators.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="model-filter" className="block text-sm font-medium text-theme-text-secondary mb-1">Model</label>
                    <select
                        id="model-filter"
                        value={selectedModel}
                        onChange={e => setSelectedModel(e.target.value)}
                        className="w-full bg-gray-800 text-white p-2 rounded-lg border border-theme-border focus:ring-2 focus:ring-theme-accent focus:border-theme-accent"
                    >
                        {availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                </div>
            </div>
            
            {totalFilteredTicks > 0 && tickResult ? (() => {
                const { tickData, forecasts, evaluations } = tickResult;

                const displayedForecasts = Object.fromEntries(
                    Object.entries(forecasts).filter(([modelId]) => selectedModel === 'All' || modelId === selectedModel)
                );
                
                const actualValue = filteredTickResults[currentTickIndex + 1]?.tickData.primary.value ?? tickData.primary.value;

                return (
                    <>
                        <div className="sticky top-0 z-10 flex justify-between items-center bg-theme-surface p-3 rounded-lg border border-theme-border shadow-lg">
                            <button onClick={handlePrev} disabled={currentTickIndex === 0} className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 flex items-center transition-colors">
                                <ChevronLeftIcon className="w-5 h-5 mr-1" /> Prev
                            </button>
                            <div className="text-center">
                                <div className="font-bold text-lg text-white">Tick {currentTickIndex + 1} / {totalFilteredTicks}</div>
                                <div className="text-sm text-theme-text-secondary">{new Date(tickData.date).toLocaleDateString()}</div>
                            </div>
                            <button onClick={handleNext} disabled={currentTickIndex === totalFilteredTicks - 1} className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50 flex items-center transition-colors">
                                Next <ChevronRightIcon className="w-5 h-5 ml-1" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1 bg-theme-surface p-4 rounded-lg border border-theme-border">
                                <h4 className="text-lg font-bold text-white mb-3">Input Data</h4>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-sm text-theme-text-secondary">{tickData.primary.title}</p>
                                        <p className="text-2xl font-bold text-theme-accent">{tickData.primary.value} <span className="text-lg font-normal text-theme-text-secondary">{tickData.primary.unit}</span></p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-white mb-2">Peer Data</p>
                                        <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
                                            {tickData.peers.map(p => (
                                                <div key={p.title} className="flex justify-between items-center p-2 bg-black/20 rounded">
                                                    <span className="text-theme-text-primary">{p.title}</span>
                                                    <span className="font-mono text-theme-text-secondary">{p.value} {p.unit}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-2 space-y-4">
                                {Object.keys(displayedForecasts).length > 0 ? (
                                    Object.entries(displayedForecasts).map(([modelId, forecast]) => {
                                        const evaluation = evaluations[modelId];
                                        if (!evaluation) return null;
                                        const modelDetails = run.results.topPerformers.find(m => m.modelId === modelId) || run.results.excludedModels.find(m => m.modelId === modelId);

                                        return (
                                            <ModelTickDetailCard 
                                                key={modelId}
                                                provider={modelDetails?.provider || 'Unknown'}
                                                modelName={modelDetails?.modelName || modelId}
                                                forecast={forecast}
                                                evaluation={evaluation}
                                                prevValue={tickData.primary.value}
                                                actualValue={actualValue}
                                            />
                                        );
                                    })
                                ) : (
                                    <div className="text-center p-8 bg-theme-surface rounded-lg border border-theme-border">
                                        <p className="text-theme-text-secondary">The selected model did not provide a forecast for this tick.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                );
            })() : (
                <div className="text-center p-8 bg-theme-surface rounded-lg border border-theme-border">
                    <p className="text-theme-text-secondary">No tick data matches the current filters.</p>
                </div>
            )}
        </div>
    );
};

const ModelTickDetailCard: React.FC<{
    provider: string; modelName: string; forecast: ForecastResult; evaluation: JudgeResult; prevValue: number | null; actualValue: number | null;
}> = ({ provider, modelName, forecast, evaluation, prevValue, actualValue }) => {
    
    const directionChange = (prev: number | null, current: number | null) => {
        if (prev === null || current === null) return { icon: null, text: 'N/A', color: 'text-gray-400' };
        if (current > prev) return { icon: <ArrowUpIcon className="w-4 h-4" />, text: 'Increased', color: 'text-green-400' };
        if (current < prev) return { icon: <ArrowDownIcon className="w-4 h-4" />, text: 'Decreased', color: 'text-red-400' };
        return { icon: null, text: 'Unchanged', color: 'text-gray-400' };
    };

    const predDirection = directionChange(prevValue, forecast.prediction);
    const actualDirection = directionChange(prevValue, actualValue);
    const isDirectionCorrect = predDirection.text === actualDirection.text && predDirection.text !== 'N/A';

    return (
        <div className="bg-theme-surface rounded-lg border border-theme-border overflow-hidden">
            <div className="p-4 bg-black/20">
                <h5 className="font-bold text-white break-all">{modelName}</h5>
                <p className="text-xs text-theme-text-secondary">{provider}</p>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {/* Prediction */}
                <div className="space-y-3">
                    <h6 className="font-semibold text-white text-sm flex items-center"><BeakerIcon className="w-5 h-5 mr-2 text-theme-accent"/>Prediction</h6>
                    <div className="pl-6">
                        <p className="text-2xl font-bold text-white">{forecast.prediction.toFixed(3)} <span className="text-lg font-normal text-theme-text-secondary">{forecast.unit}</span></p>
                        <div className={`flex items-center text-xs font-medium ${predDirection.color}`}>
                            {predDirection.icon}{predDirection.text}
                        </div>
                        <p className="text-xs text-theme-text-secondary mt-2 italic">"{forecast.rationale}"</p>
                        <p className="text-xs mt-2">Confidence: <span className="font-mono text-white">{(forecast.confidence * 100).toFixed(1)}%</span></p>
                    </div>
                </div>
                {/* Evaluation */}
                <div className="space-y-3">
                    <h6 className="font-semibold text-white text-sm flex items-center"><ChatBubbleLeftRightIcon className="w-5 h-5 mr-2 text-theme-accent"/>Evaluation</h6>
                    <div className="pl-6">
                        <div className="flex items-center space-x-4">
                            <div>
                                <p className="text-xs text-theme-text-secondary">Accuracy</p>
                                <p className="font-mono font-semibold text-white text-lg">{(evaluation.accuracy * 100).toFixed(1)}%</p>
                            </div>
                            <div>
                                <p className="text-xs text-theme-text-secondary">Error</p>
                                <p className="font-mono font-semibold text-white text-lg">{evaluation.error.toFixed(3)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-theme-text-secondary">Direction</p>
                                {isDirectionCorrect ? <CheckCircleIcon className="w-6 h-6 text-theme-success" /> : <XCircleIcon className="w-6 h-6 text-theme-destructive" />}
                            </div>
                        </div>
                        <p className="text-xs text-theme-text-secondary mt-2 italic">"{evaluation.feedback}"</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ResultsView: React.FC<ResultsViewProps> = ({ run }) => {
  const [activeTab, setActiveTab] = useState('Leaderboard');

  useEffect(() => {
    // Reset tab when run changes
    setActiveTab('Leaderboard');
  }, [run.id]);

  const handleDownload = () => {
    try {
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
            JSON.stringify(run, null, 2)
        )}`;
        const link = document.createElement('a');
        link.href = jsonString;
        link.download = `nakly-run-${run.id}.json`;
        link.click();
        link.remove();
    } catch (error) {
        console.error("Failed to download results:", error);
        // Optionally, show a toast notification on failure
    }
  };

  if (run.state === 'running') {
      return <LoadingState />;
  }
  
  const hasCompletedSuccessfully = run.state === 'completed' && run.results.topPerformers.length > 0;
  
  if (run.state === 'completed' && !hasCompletedSuccessfully && run.results.excludedModels.length > 0) {
      return (
          <div className="text-center p-8 bg-theme-surface rounded-lg border border-theme-border">
              <h3 className="text-2xl font-bold text-red-400">Backtest Failed</h3>
              <p className="text-theme-text-secondary mt-2">The backtest could not be completed. No models generated enough valid predictions to be benchmarked.</p>
              <div className="mt-6 text-left max-w-2xl mx-auto">
                 <ExcludedModelsReport excludedModels={run.results.excludedModels} />
              </div>
          </div>
      );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Leaderboard':
        return <LeaderboardTab run={run} />;
      case 'Model Comparison':
        return <ModelComparisonTab run={run} />;
      case 'Tick Data Chart':
        return <TickDataChartTab run={run} />;
      case 'Tick Analytics':
        return <TickAnalyticsTab run={run} />;
      default:
        return null;
    }
  };

  const tabs = [
    { name: 'Leaderboard', icon: <TrophyIcon className="w-5 h-5 mr-2" /> },
    { name: 'Model Comparison', icon: <ScaleIcon className="w-5 h-5 mr-2" /> },
    { name: 'Tick Data Chart', icon: <ChartBarIcon className="w-5 h-5 mr-2" /> },
    { name: 'Tick Analytics', icon: <DocumentMagnifyingGlassIcon className="w-5 h-5 mr-2" /> },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
              <h2 className="text-3xl font-bold text-white">Backtest Results</h2>
              <p className="text-sm text-theme-text-secondary mt-1">
                  Run ID: <span className="font-mono">{run.id}</span>
              </p>
          </div>
          <button
              onClick={handleDownload}
              className="flex items-center px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
          >
              <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
              Download JSON
          </button>
      </div>
      <div className="border-b border-theme-border mb-6 overflow-x-auto no-scrollbar">
        <nav className="flex -mb-px min-w-max" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`flex items-center px-4 sm:px-6 py-3 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.name
                  ? 'border-b-2 border-theme-accent text-white'
                  : 'border-b-2 border-transparent text-theme-text-secondary hover:text-white'
              }`}
              aria-current={activeTab === tab.name ? 'page' : undefined}
            >
              {tab.icon}{tab.name}
            </button>
          ))}
        </nav>
      </div>
      <div>{renderTabContent()}</div>
    </div>
  );
};