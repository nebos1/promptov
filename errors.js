// These classes describe what failed. They do not print or choose recovery actions.
// Recovery is choosen in error-handler.js


// USER CAN FIX AND TRY AGAIN ERRORS
//
export class UserMessageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UserMessageError';
    }
}

export class HistoryLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'HistoryLimitError';
    }
}

export class ClarificationLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ClarificationLimitError';
    }
}
//


// PROBLEMS WITH THE MODEL / API ANSWERS
export class ModelResponseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ModelResponseError';
    }
}

export class HistoryValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'HistoryValidationError';
    }
}

export class ApiBlockedError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ApiBlockedError';
    }
}

export class ApiRequestError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'ApiRequestError';
        this.cause = cause;
        this.status = cause?.status;
        this.code = cause?.code;
    }
}
//


// MISSING OR INVALID CONFIGURATION
export class ConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigError';
    }
}

export class TerminalIOError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'TerminalIOError';
        this.cause = cause;
    }
}