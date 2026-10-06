import { LIMITS } from './limits.js';
import { ModelResponseError, ApiBlockedError } from './errors.js';
import { hasMeaningfulText } from './validation.js';


const RESPONSE_TYPES = ['clarification', 'final', 'unsupported', 'uncensored'];

// SPII -> Sensitive Personally Identifiable Information
const BLOCKED_FINISH_REASONS = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'];

export const RESPONSE_SCHEMA = {
    type: 'object',
    properties: {
        type: {
            type: 'string',
            enum: RESPONSE_TYPES,
        },
        text: {
            type: 'string',
        },
    },
    required: ['type', 'text'],
    additionalProperties: false,
};

export function parseResponse(rawText) {
    if(typeof rawText !== 'string' || !rawText.trim()) {
        throw new ModelResponseError('Promptov returned no text!');
    }

    let data;
    try {
        data = JSON.parse(rawText);
    } catch {
        throw new ModelResponseError('Promptov returned invalid JSON!');
    }

    if(data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw new ModelResponseError('Response must be a JSON object!');
    }

    const keys = Object.keys(data);
    if(keys.length !== 2 || !keys.includes('type') || !keys.includes('text')) {
        throw new ModelResponseError('Response must contain only type and text!');
    }

    if(!RESPONSE_TYPES.includes(data.type)) {
        throw new ModelResponseError('Unknown response type!');
    }

    if(typeof data.text !== 'string' || !data.text.trim()) {
        throw new ModelResponseError('The response text must be a non-empty string!');
    }

    const text = data.text.trim();

    if(!hasMeaningfulText(text)) {
        throw new ModelResponseError('The response text must contain more than punctuation!');
    }

    validateModelResponseLength(text);

    return { type: data.type, text };
}

export function validateApiResponse(response) {
    const blockReason = response?.promptFeedback?.blockReason;
    if (blockReason) {
        throw new ApiBlockedError(
            `The request was blocked by Promptov! Modify your idea and try again!\n` +
            `Block reason: [${blockReason}]\n`
        );
    }
    
    const candidate = response?.candidates?.[0];
    if(!candidate) {
        throw new ModelResponseError('Promptov returned no answer.');
    }

    const finishReason = candidate.finishReason;
    if(finishReason === 'MAX_TOKENS') {
        throw new ModelResponseError('The response reached the maximum token limit and may be incomplete.');
    }
    if(BLOCKED_FINISH_REASONS.includes(finishReason)) {
        throw new ApiBlockedError(
            `The response was stopped by Promptov! Modify your idea and try again!\n` +
            `Stop reason: [${finishReason}]\n`
        );
    }
    if(finishReason !== 'STOP') {
        throw new ModelResponseError(
            `The request did not finish properly! Try sending it again!\n` +
            `Finish reason: [${finishReason || 'unknown finish reason'}]\n`
        );
    }

    return parseResponse(response.text);
}

// Checks the visible text field only (after trimming).
export function validateModelResponseLength(text) {
    const maximumUnits = LIMITS.MAX_PROMPTOV_RESPONSE_UNITS;
    if(text.length > maximumUnits) {
        throw new ModelResponseError(
            `Promptov's answer is too long! Try a shorter or more specific prompt!\n` +
            `Charachters length: [${text.length}]\n` +
            `Allowed characters length: [${maximumUnits}]`
        );
    }
}
