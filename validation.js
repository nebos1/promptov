import { isIP } from 'node:net';
import {
    UserMessageError,
    HistoryValidationError,
    InputRelevanceError
} from './errors.js';
import { emptyContext } from './history.js';

export function hasMeaningfulText(text) {
    return typeof text === 'string' && /[\p{L}\p{N}]/u.test(text);
}

// CHECK THE USER'S INPUT BEFORE SENDING IT
export function validateUserMessage(message) {
    if (typeof message !== 'string' || !message.trim()) {
        throw new UserMessageError('Enter a visual idea.');
    }
    if (!hasMeaningfulText(message)) {
        throw new UserMessageError('Your message needs at least one word or number.');
    }
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(message)) {
        throw new UserMessageError('Your message contains unsupported control characters.');
    }
}

// REJECT OBVIOUS OPENING NOISE WITHOUT AN API REQUEST
export function validateLocalIntent(message, hasContext = false) {
    if (hasContext) {
        return;
    }
    const text = message.trim().toLowerCase().replace(/[.!?]+$/u, '');
    const smallTalk = ['hi', 'hello', 'hey', 'hi there', 'hello there', 'how are you', 'thanks', 'thank you', 'bye', 'здравей', 'здравейте', 'здрасти'];
    if (smallTalk.includes(text) || /^(.)\1{15,}$/u.test(text)) {
        throw new InputRelevanceError();
    }
}

// HISTORY MUST CONTAIN VALID USER AND MODEL TURNS
export function validateHistory(history) {
    if (
        !Array.isArray(history) ||
        !history.length ||
        history[0]?.role !== 'user' ||
        history.at(-1)?.role !== 'user'
    ) {
        throw new HistoryValidationError('History must begin and end with a user message.');
    }
    for (const entry of history) {
        if (
            !entry ||
            !['user', 'model'].includes(entry.role) ||
            !Array.isArray(entry.parts) ||
            !entry.parts.length
        ) {
            throw new HistoryValidationError('History must contain user or model text messages.');
        }
        for (const part of entry.parts) {
            if (!part || typeof part.text !== 'string' || !part.text.trim()) {
                throw new HistoryValidationError('History messages must contain text.');
            }
        }
    }
}

export function getMessageText(message) {
    const parts = [];
    for (const part of message.parts) {
        parts.push(part.text);
    }
    return parts.join('\n');
}

export function getUserText(history) {
    const messages = [];
    for (const message of history) {
        if (message.role === 'user') {
            messages.push(getMessageText(message));
        }
    }
    return messages.join('\n');
}

// ACCEPT CONTEXT FACTS ONLY WITH THE REQUIRED EVIDENCE
export function validateContext(value = emptyContext()) {
    if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).sort().join(',') !== 'country,ip,language,summary' ||
        !(value.language === null || typeof value.language === 'string') ||
        typeof value.summary !== 'string'
    ) {
        throw new HistoryValidationError('Invalid conversation context.');
    }
    if (value.language !== null && (value.language.length > 80 || !hasMeaningfulText(value.language))) {
        throw new HistoryValidationError('Invalid conversation language.');
    }
    for (const name of ['country', 'ip']) {
        const fact = value[name];
        if (fact === null) {
            continue;
        }
        if (
            !fact ||
            typeof fact !== 'object' ||
            Array.isArray(fact) ||
            Object.keys(fact).sort().join(',') !== 'confirmed,evidence,source,value' ||
            typeof fact.value !== 'string' ||
            !fact.value.trim() ||
            fact.value.length > 100 ||
            typeof fact.evidence !== 'string' ||
            !fact.evidence.trim() ||
            fact.evidence.length > 500 ||
            !['stated', 'inferred_from_language'].includes(fact.source) ||
            fact.confirmed !== (fact.source === 'stated')
        ) {
            throw new HistoryValidationError('Facts must distinguish user statements from assumptions.');
        }
        if (
            name === 'ip' &&
            (fact.source !== 'stated' ||
                !isIP(fact.value))
        ) {
            throw new HistoryValidationError('An IP address may only be stored when supplied by the user.');
        }
    }
    return structuredClone(value);
}

// PARTIAL ANSWERS STAY SEPARATE FROM COMPLETED HISTORY
export function validateInterruptions(value = []) {
    if (!Array.isArray(value)) {
        throw new HistoryValidationError('Invalid interrupted responses.');
    }
    const result = [];
    for (const entry of value) {
        if (
            !entry ||
            entry.model !== 'assistant' ||
            typeof entry.text !== 'string' ||
            entry.complete !== false ||
            entry.stopReason !== 'output_limit'
        ) {
            throw new HistoryValidationError('Invalid interrupted model response.');
        }
        result.push({ model: entry.model, text: entry.text, complete: false, stopReason: 'output_limit' });
    }
    return result;
}

export function validateRequestHistory(history) {
    validateHistory(history);

    const result = [];
    for (const entry of history) {
        const text = getMessageText(entry);
        if (entry.role === 'user') {
            validateUserMessage(text);
        } else {
            try {
                JSON.parse(text);
            } catch {
                throw new HistoryValidationError('Complete model replies must contain valid JSON.');
            }
        }
        result.push({ role: entry.role, parts: [{ text }] });
    }
    return result;
}
