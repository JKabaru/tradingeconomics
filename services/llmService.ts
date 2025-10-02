// Service for LLM Provider Validation and Model Fetching
import type { NormalizedModel } from '../types';
import { STATIC_NORMALIZED_MODELS } from '../constants';
import { GoogleGenAI } from "@google/genai";

const MIN_CONTEXT_WINDOW = 8192;

interface ValidationResult {
  isValid: boolean;
  models?: NormalizedModel[];
  error?: string;
}

/**
 * Checks if a model is compatible with the app's requirements (text-based reasoning, sufficient context).
 * @param model - The partial model object to check.
 * @returns A compatibility object with reasons if the model is blocked.
 */
function checkCompatibility(model: Omit<NormalizedModel, 'compatibility'>): NormalizedModel['compatibility'] {
    if (model.modality !== 'text' && model.modality !== 'multimodal') {
        return {
            allowed: false,
            reasoning: false,
            reasonIfBlocked: `This is an '${model.modality}' model and does not support text-based reasoning required for backtesting.`
        };
    }

    if (model.context < MIN_CONTEXT_WINDOW) {
        return {
            allowed: false,
            reasoning: true, // It's a reasoning model, just with too small a context window.
            reasonIfBlocked: `Context window of ${model.context.toLocaleString()} tokens is too small. A minimum of ${MIN_CONTEXT_WINDOW.toLocaleString()} is required for reliable analysis.`
        };
    }
    
    return {
        allowed: true,
        reasoning: true,
    };
}


async function fetchWithTimeout(url: string, options: RequestInit, timeout = 15000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(url, {
        ...options,
        signal: controller.signal
    });
    clearTimeout(id);
    return response;
}

/**
 * Provides user-friendly error messages based on HTTP status codes from the API.
 * @param response - The Fetch API response object.
 * @returns A string containing a user-friendly error message.
 */
async function handleApiError(response: Response): Promise<string> {
    if (response.status === 401) return 'Invalid API Key. Please verify your OpenRouter key and try again.';
    if (response.status === 403) return 'Your OpenRouter key does not have permission for this operation.';
    if (response.status === 429) return 'Rate limit exceeded with OpenRouter. Please wait a moment before trying again.';
    if (response.status >= 500) return 'OpenRouter is experiencing technical difficulties. Please try again later.';

    try {
        const errorJson = await response.json();
        return errorJson.error?.message || `Request failed with status: ${response.status}`;
    } catch {
        return `Request failed with status: ${response.status}`;
    }
}

/**
 * Determines the original model provider (e.g., Google, Meta) from the model ID string.
 * @param id - The model ID from OpenRouter.
 * @returns The name of the source provider.
 */
function getSourceProvider(id: string): string {
    const knownPrefixes: [string, string][] = [
        ['google/', 'Google'],
        ['meta-llama/', 'Meta'],
        ['mistralai/', 'Mistral AI'],
        ['anthropic/', 'Anthropic'],
        ['openai/', 'OpenAI'],
        ['deepseek/', 'DeepSeek'],
        ['microsoft/', 'Microsoft'],
        ['cohere/', 'Cohere'],
        ['nousresearch/', 'Nous Research'],
        ['teknium/', 'Teknium'],
        ['jondurbin/', 'Jon Durbin'],
        ['neversleep/', 'NeverSleep'],
        ['cognitivecomputations/', 'Cognitive Computations'],
        ['fireworks/', 'Fireworks'],
        ['databricks/', 'Databricks'],
        ['recursal/', 'Recursal'],
        ['01-ai/', '01.AI'],
        ['intel/', 'Intel'],
    ];

    for (const [prefix, provider] of knownPrefixes) {
        if (id.startsWith(prefix)) return provider;
    }
    
    if (id.includes('claude')) return 'Anthropic';
    if (id.includes('gpt')) return 'OpenAI';
    if (id.includes('gemini')) return 'Google';
    if (id.includes('llama')) return 'Meta';

    return 'Other';
}

/**
 * Normalizes the raw model data from OpenRouter's API into our app's structured format.
 * @param rawModels - The array of model objects from the API.
 * @param provider - The service provider name (always 'OpenRouter').
 * @returns An array of normalized models.
 */
function normalizeOpenRouterModels(rawModels: any[], provider: string): NormalizedModel[] {
    if (!Array.isArray(rawModels)) {
        console.error("OpenRouter API did not return a valid array of models:", rawModels);
        return [];
    }
    return rawModels.map((m: any): NormalizedModel => {
        const modelId = m.id;

        const partialModel: Omit<NormalizedModel, 'compatibility'> = {
            id: modelId,
            name: m.name || modelId,
            provider,
            sourceProvider: getSourceProvider(modelId),
            context: m.context_length || 0,
            modality: m.architecture?.modality === 'text' ? 'text' : 'multimodal', // Simplification
            pricing: {
                free: parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0,
                inputCost: parseFloat(m.pricing.prompt || '0') * 1000000,
                outputCost: parseFloat(m.pricing.completion || '0') * 1000000,
            }
        };
        const compatibility = checkCompatibility(partialModel);
        return { ...partialModel, compatibility };
    });
}

async function validateOpenRouter(apiKey: string): Promise<ValidationResult> {
    try {
        const response = await fetchWithTimeout('https://openrouter.ai/api/v1/models', {
            headers: { 
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://nakly.com',
                'X-Title': 'Nakly',
            }
        });
        if (!response.ok) {
             return { isValid: false, error: await handleApiError(response) };
        }
        const data = await response.json();
        const models = normalizeOpenRouterModels(data.data, 'OpenRouter');
        return { isValid: true, models };
    } catch (e: any) {
        if (e.name === 'AbortError') {
            return { isValid: false, error: 'Request to OpenRouter timed out. Please check your connection.' };
        }
        return { isValid: false, error: 'A network error occurred. Please check your connection and try again.' };
    }
}

async function validateGoogleGemini(apiKey: string): Promise<ValidationResult> {
    try {
        const ai = new GoogleGenAI({ apiKey });
        // Use a lightweight model for a quick, inexpensive validation call.
        await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'ping',
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });

        // If the call succeeds, fetch static models and check compatibility.
        const staticModels = STATIC_NORMALIZED_MODELS['Google Gemini'] || [];
        const models: NormalizedModel[] = staticModels.map(m => {
            const partialModel = { ...m, provider: 'Google Gemini' };
            const compatibility = checkCompatibility(partialModel);
            return { ...partialModel, compatibility };
        });

        return { isValid: true, models };

    } catch (e: any) {
        let errorMessage = 'An unknown error occurred during Google Gemini validation.';
        if (e instanceof Error) {
            if (e.message.includes('API key not valid')) {
                errorMessage = 'Invalid API Key. Please check your Google Gemini key.';
            } else {
                 errorMessage = e.message;
            }
        }
        return { isValid: false, error: errorMessage };
    }
}

export const validateLlmProvider = async (provider: string, apiKey: string): Promise<ValidationResult> => {
    if (provider === 'OpenRouter') {
        return validateOpenRouter(apiKey);
    }
    if (provider === 'Google Gemini') {
        return validateGoogleGemini(apiKey);
    }
    return { isValid: false, error: 'Unsupported LLM provider.' };
};