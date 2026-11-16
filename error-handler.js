import {
    UserMessageError,
    HistoryLimitError,
    HistoryValidationError,
    ModelResponseError,
    ApiBlockedError,
    BackendRequestError,
    ConfigError,
    TerminalIOError
} from './errors.js';
import { GenerationUnavailableError } from './errors.js';

function proceed(message) {
    return { action: 'continue', message, exitCode: 0 };
}

function stop(message) {
    return { action: 'exit', message, exitCode: 1 };
}

// HANDLE LOCAL, BACKEND AND MODEL ERRORS IN ONE PLACE
export function getErrorOutcome(error, inputClosed = false) {
    if (inputClosed) {
        return { action: 'exit', message: 'Input closed. Exiting Promptov...', exitCode: 0 };
    }

    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof GenerationUnavailableError) {
        return proceed(message);
    }

    if (error instanceof UserMessageError) {
        return proceed(message);
    }

    if (error instanceof HistoryLimitError) {
        return proceed(message);
    }

    if (error instanceof ApiBlockedError) {
        return proceed(message);
    }

    if (error instanceof ModelResponseError) {
        return proceed(`[${message}] Send your message again.`);
    }

    if (error instanceof BackendRequestError) {
        if (error.status === 401 || error.status === 403) {
            return stop('Access to the Promptov backend was denied.');
        }
        if (error.status === 404) {
            return stop('Promptov backend endpoint not found. Check PROMPTOV_API_URL.');
        }
        return proceed(error.message);
    }

    if (error instanceof ConfigError) {
        return stop(message);
    }
    if (error instanceof HistoryValidationError) {
        return stop(`Internal error: [${message}]`);
    }
    if (error instanceof TerminalIOError) {
        return stop(`Terminal error: [${message}]`);
    }

    return stop(message);
}
