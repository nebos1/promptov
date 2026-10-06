#!/usr/bin/env node
import dotenv from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { generatePrompt, getGeminiConfig } from './gemini.js';
import { validateUserMessage, validateHistorySize, validateClarificationRounds } from './validation.js';
import { TerminalIOError } from './errors.js';
import { getErrorOutcome } from './error-handler.js';
import { stripVTControlCharacters } from 'node:util';

function cleanTerminalText(text) {
    return stripVTControlCharacters(String(text))
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
}

function readSubmission(terminal, label, signal) {
    return new Promise((resolve, reject) => {
        const lines = [];

        function finish(error, value) {
            terminal.off('line', onLine);
            terminal.off('error', onError);
            signal.removeEventListener('abort', onAbort);

            if (error) {
                reject(error);
            } else {
                resolve(value);
            }
        }

        function onLine(line) {
            if (line.trim() === '/send') {
                finish(null, lines.join('\n'));
                return;
            }

            if (lines.length === 0 && line.trim() === '0') {
                finish(null, '0');
                return;
            }

            lines.push(line);
        }

        function onError(error) {
            finish(error);
        }

        function onAbort() {
            const error = new Error('Input closed.');
            error.code = 'ABORT_ERR';
            finish(error);
        }

        if (signal.aborted) {
            onAbort();
            return;
        }

        terminal.on('line', onLine);
        terminal.once('error', onError);
        signal.addEventListener('abort', onAbort, { once: true });

        stdout.write(label);
    });
}

dotenv.config({ quiet: true });

try {
    getGeminiConfig();
} catch (error) {
    const outcome = getErrorOutcome(error);
    console.error(
        'An error occurred:',
        `[${cleanTerminalText(outcome.message)}]`
    );
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
        const label = isFirstTurn
            ? "Enter your visual idea. Type /send on its own line to submit, or 0 to exit:\n"
            : "Enter your reply. Type /send on its own line to submit, or 0 to exit:\n";
        let userInput;
        try {
            userInput = await readSubmission(
                terminal,
                label,
                inputController.signal
            );
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
        console.log(`Promptov:\n${cleanTerminalText(response.text)}\n`);

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
            console.log(cleanTerminalText(outcome.message));
        } else {
            console.error(
                'An error occurred:',
                `[${cleanTerminalText(outcome.message)}]`
            );
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
