// THESE CLASSES DESCRIBE WHAT FAILED. THEY DO NOT PRINT OR CHOOSE RECOVERY ACTIONS.
// RECOVERY IS CHOSEN IN ERROR-HANDLER.JS.

// USER CAN FIX AND TRY AGAIN ERRORS
//
export class UserMessageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UserMessageError';
    }
}

export class UserMessageLimitError extends UserMessageError {
    constructor(message) {
        super(message);
        this.name = 'UserMessageLimitError';
    }
}

export class InputRelevanceError extends UserMessageError {
    constructor() {
        super('Describe a visual idea or answer the current image-related question.');
        this.name = 'InputRelevanceError';
    }
}

export class HistoryLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'HistoryLimitError';
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

export class BackendRequestError extends Error {
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.status = cause?.status;
        this.code = cause?.code;
        this.name = 'BackendRequestError';
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

export class GenerationUnavailableError extends Error {
    constructor() {
        super(
            'Promptov is temporarily unable to respond. Your conversation has been kept. Resubmit later with /send, or use /new for a fresh idea.'
        );
        this.name = 'GenerationUnavailableError';
    }
}

export class TerminalIOError extends Error {
    constructor(message, cause) {
        super(message);
        this.name = 'TerminalIOError';
        this.cause = cause;
    }
}
