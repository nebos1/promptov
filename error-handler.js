import { UserMessageError, HistoryLimitError, ClarificationLimitError, HistoryValidationError, ModelResponseError, ApiBlockedError, ApiRequestError, ConfigError, TerminalIOError } from './errors.js';

// Network problems
const NETWORK_CODES = new Set([
    'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ECONNABORTED', 'EAI_AGAIN', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT',
]);

const proceed = (message) => ({ action: 'continue', message, exitCode: 0 });
const restart = (message) => ({ action: 'reset', message, exitCode: 0 });
const stop = (message) => ({ action: 'exit', message, exitCode: 1 });

function getApiErrorOutcome(error) {
    const status = error.status;
    let code = error.code;
    const causeName = error.cause?.name;
    if (!code && error.cause) {
        code = error.cause.code;
        if (!code && error.cause.cause) {
            code = error.cause.cause.code;
        }
    }    

    if(status === 401 || status === 403) {
        return stop('API key denied!');
    }
    if(status === 404) {
        return stop('API model not found!');
    }
    if(status === 400) {
        return stop(`The request was rejected!`);    
    }
    if(status === 429) {
        return proceed('Promptov limit reached!');
    }
    if(status === 408 || (typeof status === 'number' && status >= 500)) {
        return proceed('Promptov is temporarily unavailable!');
    }
    if(causeName === 'AbortError' || causeName === 'TimeoutError' || NETWORK_CODES.has(code)) {
        return proceed('The request timed out or the network failed! Check your connection and try again!');
    }

    return stop(error.message);
}

export function getErrorOutcome(error, inputClosed = false) {
    if(inputClosed && error?.code === 'ABORT_ERR') {
        return { action: 'exit', message: 'Input closed. Exiting Promptov...', exitCode: 0 };
    }

    const message = error instanceof Error ? error.message : String(error);

    if(error instanceof UserMessageError) {
        return proceed(message);
    }

    if(error instanceof HistoryLimitError || error instanceof ClarificationLimitError) {
        return restart(message);
    }

    if(error instanceof ApiBlockedError) {
        return proceed(message);
    }

    if(error instanceof ModelResponseError) {
        return proceed(`[${message}] Send your message again.`);
    }

    if(error instanceof ApiRequestError) {
        return getApiErrorOutcome(error);
    }

    if(error instanceof ConfigError) {
        return stop(message);
    }
    if(error instanceof HistoryValidationError) {
        return stop(`Internal error: [${message}]`);
    }
    if(error instanceof TerminalIOError) {
        return stop(`Terminal error: [${message}]`);
    }

    return stop(message);
}
