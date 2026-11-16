import { ModelResponseError } from './errors.js';
import { hasMeaningfulText, validateContext } from './validation.js';

// REJECT MALFORMED ANSWERS BEFORE THEY REACH THE TERMINAL
export function parseResponse(rawText) {
    let data;
    let text = typeof rawText === 'string' ? rawText.trim() : rawText;
    if (typeof text === 'string' && text.startsWith('```')) {
        const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
        if (fenced) {
            text = fenced[1];
        }
    }
    try {
        data = JSON.parse(text);
    } catch {
        throw new ModelResponseError('Promptov returned invalid JSON.');
    }
    if (
        !data ||
        typeof data !== 'object' ||
        Array.isArray(data) ||
        Object.keys(data).sort().join(',') !== 'context,text,type' ||
        !['clarification', 'final', 'unsupported', 'uncensored'].includes(data.type) ||
        typeof data.text !== 'string' ||
        !hasMeaningfulText(data.text)
    ) {
        throw new ModelResponseError('Promptov returned an invalid response.');
    }
    let context;
    try {
        context = validateContext(data.context);
    } catch {
        throw new ModelResponseError('The answer contained invalid conversation context.');
    }
    return { type: data.type, text: data.text.trim(), context };
}
