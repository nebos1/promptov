import { parseResponse } from './response.js';
import { validateRequestHistory, validateContext, validateInterruptions } from './validation.js';
import {
    BackendRequestError,
    ApiBlockedError,
    ConfigError,
    HistoryValidationError,
    HistoryLimitError,
    UserMessageError,
    UserMessageLimitError,
    ModelResponseError,
    GenerationUnavailableError,
    InputRelevanceError
} from './errors.js';

import { DEFAULT_API_URL } from './config.js';

// TURN BACKEND ERROR CODES INTO SAFE CLIENT ERRORS
function remoteError(code, status = 503) {
    if (code === 'GENERATION_UNAVAILABLE') {
        return new GenerationUnavailableError();
    }
    if (code === 'INPUT_OFF_TOPIC') {
        return new InputRelevanceError();
    }
    if (code === 'INPUT_CHECK_UNAVAILABLE') {
        return new BackendRequestError('The input check is temporarily unavailable. Try again shortly.');
    }
    if (code === 'USER_MESSAGE_INVALID') {
        return new UserMessageError('Enter a valid visual idea.');
    }
    if (code === 'USER_MESSAGE_LIMIT') {
        return new UserMessageLimitError('Your message is too long. Shorten it and try again.');
    }
    if (code === 'HISTORY_INVALID') {
        return new HistoryValidationError('The backend rejected the session history.');
    }
    if (code === 'HISTORY_LIMIT') {
        return new HistoryLimitError('Session history is full. Use /new to start a fresh idea.');
    }
    if (code === 'REQUEST_BLOCKED') {
        return new ApiBlockedError('This request was blocked. Modify your idea.');
    }
    if (code === 'RESPONSE_INVALID') {
        return new ModelResponseError('Promptov returned an invalid response.');
    }

    let message = 'The Promptov backend is temporarily unavailable.';
    if (status === 429) {
        message = 'Promptov is busy. Try again shortly.';
    }
    const error = new BackendRequestError(message);
    error.status = status;
    return error;
}

function validateEndpoint(endpoint) {
    if (!endpoint) {
        throw new ConfigError('The Promptov service address is not configured. Set PROMPTOV_API_URL or contact the package maintainer.');
    }
    try {
        const url = new URL(endpoint);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
            throw new Error();
        }
        return url.href;
    } catch {
        throw new ConfigError('PROMPTOV_API_URL must be an HTTP or HTTPS address without credentials.');
    }
}

// READ BOUNDED JSON OR LINE-BY-LINE PROGRESS UPDATES
async function readBody(response, onLine) {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new BackendRequestError('The backend returned no response.');
    }
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let text = '';
    let bytes = 0;

    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done) {
                text += decoder.decode();
                break;
            }
            bytes += chunk.value.byteLength;
            if (bytes > 131072) {
                throw new BackendRequestError('The backend response is too large.');
            }
            text += decoder.decode(chunk.value, { stream: true });

            if (onLine) {
                let end = text.indexOf('\n');
                while (end >= 0) {
                    const line = text.slice(0, end);
                    text = text.slice(end + 1);
                    if (line.trim()) {
                        await onLine(line);
                    }
                    end = text.indexOf('\n');
                }
            }
        }
        if (onLine && text.trim()) {
            await onLine(text);
        }
        return text;
    } finally {
        try {
            await reader.cancel();
        } catch {}
        reader.releaseLock();
    }
}

async function readReply(response, options) {
    const streaming = response.headers.get('content-type')?.includes('application/x-ndjson');
    if (!streaming) {
        const text = await readBody(response);
        if (!response.ok) {
            let code;
            try {
                code = JSON.parse(text)?.error?.code;
            } catch {}
            throw remoteError(code, response.status);
        }
        return parseResponse(text);
    }

    let result = null;
    let pendingError = null;
    let partials = 0;

    async function readEvent(line) {
        let event;
        try {
            event = JSON.parse(line);
        } catch {
            throw new ModelResponseError('Invalid backend event.');
        }
        if (!event || typeof event !== 'object') {
            throw new ModelResponseError('Invalid backend event.');
        }
        if (result || pendingError) {
            throw new ModelResponseError('Unexpected event after the response ended.');
        }

        if (event.event === 'reply') {
            result = parseResponse(JSON.stringify(event.response));
            return;
        }
        if (event.event === 'error') {
            pendingError = remoteError(event.error?.code);
            return;
        }
        if (event.event === 'partial') {
            partials++;
            if (partials > 6) {
                throw new ModelResponseError('Too many interrupted responses.');
            }
            const partial = validateInterruptions([event.partial])[0];
            if (options.onPartial) {
                await options.onPartial(partial);
            }
            return;
        }
        if (event.event === 'waiting') {
            if (!Number.isSafeInteger(event.position) || event.position < 1 || event.position > 1000) {
                throw new ModelResponseError('Invalid queue event.');
            }
            if (options.onWaiting) {
                await options.onWaiting(event.position);
            }
            return;
        }
        throw new ModelResponseError('Unknown backend event.');
    }

    await readBody(response, readEvent);
    if (pendingError) {
        throw pendingError;
    }
    if (!result) {
        throw new ModelResponseError('The backend returned no completed answer.');
    }
    return result;
}

function isKnownError(error) {
    return error instanceof BackendRequestError ||
        error instanceof ModelResponseError ||
        error instanceof UserMessageError ||
        error instanceof HistoryLimitError ||
        error instanceof HistoryValidationError ||
        error instanceof ApiBlockedError ||
        error instanceof GenerationUnavailableError;
}

// SEND SESSION DATA WITH A TIMEOUT LONG ENOUGH FOR A COLD START
export function createApiClient({
    endpoint = process.env.PROMPTOV_API_URL?.trim() || DEFAULT_API_URL,
    timeoutMs = 240000,
    fetchImpl = globalThis.fetch
} = {}) {
    const url = validateEndpoint(endpoint);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) {
        throw new ConfigError('Invalid request timeout.');
    }

    return async function generatePrompt(userInput, history, options = {}) {
        const body = {
            history: validateRequestHistory(history),
            context: validateContext(options.context),
            interruptions: validateInterruptions(options.interruptions)
        };
        const timeout = AbortSignal.timeout(timeoutMs);
        let signal = timeout;
        if (options.signal) {
            signal = AbortSignal.any([options.signal, timeout]);
        }

        try {
            const response = await fetchImpl(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json, application/x-ndjson'
                },
                body: JSON.stringify(body),
                signal,
                redirect: 'error'
            });
            return await readReply(response, options);
        } catch (error) {
            if (options.signal?.aborted) {
                const closed = new Error('Input closed.');
                closed.code = 'ABORT_ERR';
                throw closed;
            }
            if (isKnownError(error)) {
                throw error;
            }
            if (timeout.aborted) {
                throw new BackendRequestError('The backend request timed out.');
            }
            throw new BackendRequestError('Could not reach the Promptov backend. Check the server and your connection.');
        }
    };
}

export async function generatePrompt(userInput, history, options) {
    const client = createApiClient();
    return client(userInput, history, options);
}
