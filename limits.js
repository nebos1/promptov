// Application limits
// Units = string.length
export const LIMITS = Object.freeze({
    MAX_USER_MESSAGE_UNITS: 2000, // general, for user input prompt and user clarification message 
    MAX_WHOLE_CONVERSATION_UNITS: 30000, // tracks whole conversation, including user and model messages (used and in history limits)
    MAX_CLARIFICATION_ROUNDS: 10, // 1 round may consist of different number of clarification questions
    MAX_PROMPTOV_RESPONSE_UNITS: 2000, // general, for model response text, including clarification questions and final answer
    MAX_API_TIMEOUT_MS: 60000, // 60 seconds, for API request timeout
});