#!/usr/bin/env node
import dotenv from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { generatePrompt, getGeminiConfig } from './gemini.js';
import { validateUserMessage, validateHistorySize, validateClarificationRounds } from './validation.js';
import { TerminalIOError } from './errors.js';
import { getErrorOutcome } from './error-handler.js';

dotenv.config({ quiet: true });

try {
    getGeminiConfig();
} catch (error) {
    const outcome = getErrorOutcome(error);
    console.error('An error occurred:', `[${outcome.message}]`);
    process.exit(outcome.exitCode);
}

const terminal = createInterface({ input: stdin, output: stdout });

const inputController = new AbortController();
terminal.once('close', () => {
    inputController.abort();
});

// Accepted messages for the current idea only.
let isFirstTurn = true;
let history = [];
let clarificationRounds = 0;

function startNewIdea() {
    isFirstTurn = true;
    history = [];
    clarificationRounds = 0;
}

while (!inputController.signal.aborted) {
    try {
        const label = isFirstTurn ? "Enter your visual idea (or type '0' to exit): " : "Your reply: \n";
        let userInput;
        try {
            userInput = await terminal.question(label, {
                signal: inputController.signal,
            });
        } catch (error) {
            if(inputController.signal.aborted && error?.code === 'ABORT_ERR') {
                throw error;
            }
            const message = error instanceof Error ? error.message : String(error);
            throw new TerminalIOError(message, error);
        }
        const idea = userInput.trim();

        if(idea === '0') {
            console.log("Exiting Promptov...");
            break;
        }

        validateUserMessage(idea);
        const userMessage = {
            role: 'user',
            parts: [{ text: idea }],
        };

        const requestHistory = history.concat(userMessage);
        validateHistorySize(requestHistory);
        console.log('\nGenerating a response...\n');
        const response = await generatePrompt(idea, requestHistory);

        // count the round before saving anything
        if(response.type === 'clarification') {
            clarificationRounds += 1;
            validateClarificationRounds(clarificationRounds);
        }

        const modelMessage = {
            role: "model",
            parts: [{ text: JSON.stringify(response) }]
        };
        history = requestHistory.concat(modelMessage);
        console.log(`Promptov:\n${response.text}\n`);

        if(response.type === 'uncensored') {
            console.log("The request was flagged for safety reasons! Modify your request and try again!\n");
        }

        if(response.type === 'clarification') {
            isFirstTurn = false;
        } else {
            startNewIdea();
        }

    } catch (error) {
        const outcome = getErrorOutcome(error, inputController.signal.aborted);
        if(outcome.exitCode === 0) {
            console.log(outcome.message);
        } else {
            console.error('An error occurred:', `[${outcome.message}]`);
        }

        if(outcome.action === 'continue') {
            continue;
        }
        if(outcome.action === 'reset') {
            startNewIdea();
            continue;
        }
        process.exitCode = outcome.exitCode;
        break;
    }
}

terminal.close();
