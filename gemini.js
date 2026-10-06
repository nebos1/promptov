import { GoogleGenAI } from "@google/genai";
import { BASE_INSTRUCTIONS } from './instructions.js';
import { LIMITS } from './limits.js';
import { validateUserMessage, validateHistory } from './validation.js';
import { RESPONSE_SCHEMA, validateApiResponse } from './response.js';
import { ApiRequestError, ConfigError } from './errors.js';

const DEFAULT_MODEL = "gemini-3.8-flash";

export function getGeminiConfig() {
    const apiKey = process.env.API_KEY?.trim();
    const model = process.env.MODEL?.trim() || DEFAULT_MODEL;

    if (!apiKey) {
        throw new ConfigError('API_KEY is not set!');
    }

    return { apiKey, model };
}

export async function generatePrompt(userInput, history) {

    validateUserMessage(userInput);
    validateHistory(history);

    const { apiKey, model } = getGeminiConfig();

    let AIResponse;
    try {
        const AI = new GoogleGenAI({
            apiKey: apiKey,
            httpOptions: {
                timeout: LIMITS.MAX_API_TIMEOUT_MS,
            },
        });

        AIResponse = await AI.models.generateContent({
            model: model,
            contents: history,
            config: {
                systemInstruction: BASE_INSTRUCTIONS,
                responseJsonSchema: RESPONSE_SCHEMA,
                responseMimeType: "application/json"
            }
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new ApiRequestError(message, error);
    }

    return validateApiResponse(AIResponse);
}
