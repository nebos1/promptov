import { LIMITS } from './limits.js';
import { UserMessageError, HistoryValidationError, HistoryLimitError, ClarificationLimitError } from './errors.js';

// text containing atleast 1 letter or number
const MEANINGFUL_TEXT = /[\p{L}\p{N}]/u;
// char control except TAB, NEW LINE, CARRIAGE RETURN
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function hasMeaningfulText(text) {
    return typeof text === 'string' && MEANINGFUL_TEXT.test(text);
}

export function validateUserMessage(message) {
    if(typeof message !== 'string' || !message.trim()) {
        throw new UserMessageError('No input provided. Enter a valid visual idea!');
    }
    if(!hasMeaningfulText(message)) {
        throw new UserMessageError('Your message needs at least one word or number!');
    }
    if(CONTROL_CHARS.test(message)) {
        throw new UserMessageError('Your message contains unsupported control characters!');
    }
    validateUserMessageLength(message);
}

// measuring the trimmed message
export function validateUserMessageLength(message) {
    const maximumUnits = LIMITS.MAX_USER_MESSAGE_UNITS;
    const length = message.trim().length;
    if(length > maximumUnits) {
        throw new UserMessageError(
            `Your message is too long! Shorten it and try again!\n` +
            `Your message characters length: [${length}]\n` +
            `Allowed characters length: [${maximumUnits}]`
        );
    }
}

// history rule:
// user -> model -> user -> model ... (ending with user message)
export function validateHistory(history) {
    if (!Array.isArray(history) || history.length === 0) {
        throw new HistoryValidationError('Conversation history must not be empty!');
    }

    for (let index = 0; index < history.length; index++) {
        const entry = history[index];
        const expectedRole = index % 2 === 0 ? 'user' : 'model';

        if (entry === null || typeof entry !== 'object') {
            throw new HistoryValidationError(`History entry [${index}] must be an object!`);
        }

        if (entry.role !== expectedRole) {
            throw new HistoryValidationError(`History entry [${index}] must have the role "${expectedRole}"!`);
        }

        if (!Array.isArray(entry.parts) || entry.parts.length === 0) {
            throw new HistoryValidationError(`History entry [${index}] must contain non-empty text parts!`);
        }

        for (let j = 0; j < entry.parts.length; j++) {
            const part = entry.parts[j];
            
            if (!part || typeof part.text !== 'string' || part.text.trim() === '') {
                throw new HistoryValidationError(`History entry [${index}] must contain non-empty text parts!`);
            }
        }
    }

    if (history.length % 2 === 0) {
        throw new HistoryValidationError('Conversation history must end with a model message!');
    }
}

//call this on the proposed request (history + the new user message) before sending it.
export function validateHistorySize(history) {
    const max = LIMITS.MAX_WHOLE_CONVERSATION_UNITS;
    let total = 0;

    for (let i = 0; i < history.length; i++) {
        const entry = history[i];
        if (entry && entry.parts) {
            for (let j = 0; j < entry.parts.length; j++) {
                const part = entry.parts[j];
                if (part && part.text) {
                    total += part.text.length;
                }
            }
        }
    }

    if (total > max) {
        throw new HistoryLimitError(
            `The conversation chat with Promptov became too long! Shorten it and try again!\n` +
            `Your message characters length: [${total}]\n` +
            `Allowed conversation length: [${max}]`
        );
    }
}

// rounds = number of responses of clarification questions received for the current idea
// 1 round may consist of different amount of clarification questions. 
export function validateClarificationRounds(rounds) {
    const maximumRounds = LIMITS.MAX_CLARIFICATION_ROUNDS;
    if(!Number.isInteger(rounds) || rounds < 0) {
        throw new HistoryValidationError('The clarification round counter is invalid!');
    }
    if(rounds > maximumRounds) {
        throw new ClarificationLimitError(
            `Promptov needed more than [${maximumRounds}] clarification rounds!`
        );
    }
}

