

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// IMPORTANT: This assumes process.env.API_KEY is set in the environment for insights generation.
// This key is now expected to be an OpenRouter API key.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY environment variable not set for insights generation. This should be an OpenRouter API key.");
}

const callOpenRouter = async (apiKey: string, modelName: string, prompt: string) => {
    const body = {
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://nakly.com', 
            'X-Title': 'Nakly',
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        let userFriendlyMessage;
        switch (response.status) {
            case 401:
                userFriendlyMessage = "Invalid API Key provided for OpenRouter.";
                break;
            case 402:
                 userFriendlyMessage = "Not enough credits. Please check your OpenRouter account balance.";
                 break;
            case 403:
                userFriendlyMessage = `Model '${modelName}' is not available. This might be due to your OpenRouter settings or model access permissions.`;
                break;
            case 429:
                userFriendlyMessage = "Rate limit hit for this model. Please retry shortly or check your OpenRouter account limits.";
                break;
            default:
                userFriendlyMessage = `Model call failed. The provider returned status: ${response.status}. The model may be temporarily unavailable.`;
        }
        try {
            const errorText = await response.text();
            const errorJson = JSON.parse(errorText);
            const detailedMessage = errorJson.error?.message;
            if (detailedMessage) {
                 throw new Error(`[${modelName}] ${userFriendlyMessage} Details: ${detailedMessage}`);
            }
        } catch {
             // Ignore parsing errors, fall back to the user friendly message
        }
        throw new Error(`[${modelName}] ${userFriendlyMessage}`);
    }
    return await response.json();
};

const callGoogleGemini = async (apiKey: string, modelName: string, prompt: string): Promise<GenerateContentResponse> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
        });
        return response;
    } catch (error) {
        console.error("Google Gemini API Error:", error);
        if (error instanceof Error) {
            throw new Error(`[${modelName}] Google Gemini API call failed: ${error.message}`);
        }
        throw new Error(`[${modelName}] An unknown error occurred with the Google Gemini API.`);
    }
};

const parseJsonFromText = (text: string): any => {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error("Failed to parse extracted JSON:", e, "Raw text:", text);
            throw new Error("Model returned malformed JSON.");
        }
    }
    throw new Error("LLM did not return a valid JSON object.");
};


export const generateJsonContent = async (prompt: string, model: string, apiKeys: Record<string, string>): Promise<any> => {
  const [provider, modelId] = model.split('::');
  const apiKey = apiKeys[provider];

  if (!apiKey) {
    throw new Error(`API key for ${provider} is not configured.`);
  }

  try {
    let rawTextResponse = '';
    if (provider === 'OpenRouter') {
        const res = await callOpenRouter(apiKey, modelId, prompt);
        rawTextResponse = res.choices?.[0]?.message?.content || '';
    } else if (provider === 'Google Gemini') {
        const res = await callGoogleGemini(apiKey, modelId, prompt);
        rawTextResponse = res.text;
    } else {
        throw new Error(`Unsupported provider: ${provider}`);
    }
    
    return parseJsonFromText(rawTextResponse);
  } catch (error) {
    console.error(`Error generating JSON content from ${provider} for model ${modelId}:`, error);
    if (error instanceof Error) {
        // Re-throw the user-friendly error from the calling function
        throw error;
    }
    throw new Error(`An unknown error occurred while calling ${modelId}.`);
  }
};