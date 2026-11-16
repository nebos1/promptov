#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { generatePrompt } from './api-client.js';
import { validateUserMessage, validateLocalIntent } from './validation.js';
import { createHistory } from './history.js';
import { TerminalIOError } from './errors.js';
import { getErrorOutcome } from './error-handler.js';
import { stripVTControlCharacters } from 'node:util';

// KEEP MODEL OUTPUT SAFE FOR THE TERMINAL
function cleanTerminalText(text) {
    return stripVTControlCharacters(String(text))
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
}

// DISPLAY EACH CLARIFICATION QUESTION ON ITS OWN LINE
function formatAnswer(response) {
    const text = cleanTerminalText(response.text);
    if (response.type === 'clarification') {
        return text.replace(/([?？])[ \t]+(?=\S)/g, '$1\n');
    }
    return text;
}

// READ A MULTILINE DRAFT; COMMANDS USE THEIR OWN LINE
async function readSubmission(inputLines, label) {
    const lines = [];
    stdout.write(label);

    while (true) {
        const next = await inputLines.next();
        if (next.done) {
            return null;
        }
        const line = next.value;
        const command = line.trim();
        if (command === '/send') {
            return lines.join('\n');
        }
        if (command === '/new' || command === '/exit') {
            return command;
        }
        if (command.startsWith('/')) {
            console.error(`promptov error Unknown command: ${JSON.stringify(cleanTerminalText(command))}`);
            console.error('promptov error Did you mean one of these?');
            console.error('promptov error   /send');
            console.error('promptov error   /new');
            console.error('promptov error   /exit');
            console.error('promptov error Your current draft was kept.');
            continue;
        }
        lines.push(line);
    }
}

// ONE INPUT READER ALSO KEEPS LINES FROM A PASTED BLOCK
const terminal = createInterface({ input: stdin, output: stdout });
const inputLines = terminal[Symbol.asyncIterator]();

const inputController = new AbortController();
terminal.once('close', () => {
    inputController.abort();
});

const session = createHistory();
let isFirstTurn = true;
let lastFailedInput = null;
let submitted = false;

// KEEP INTERRUPTED OUTPUT SILENTLY FOR A LATER ATTEMPT
function savePartial(partial) {
    session.addInterrupted(partial);
}

async function showWaiting(position) {
    console.log(`Waiting for available capacity. Queue position: ${position}.`);
}

console.log('Promptov');
console.log('Write your visual idea over one or more lines.');
console.log('Commands (type each on its own line):');
console.log('  /send   Send your current draft.');
console.log('  /new    Discard your draft and clear this conversation.');
console.log('  /exit   Exit Promptov.');
console.log('History is kept only while Promptov runs.\n');

// KEEP HISTORY AND FAILED SUBMISSION DETAILS ONLY FOR THIS RUN
try {
    while (!inputController.signal.aborted) {
        try {
            const label = isFirstTurn
                ? 'Enter your visual idea.\n'
                : 'Enter your reply.\n';
            let text;
            try {
                text = await readSubmission(inputLines, label);
            } catch (error) {
                if (inputController.signal.aborted) {
                    throw error;
                }
                throw new TerminalIOError('Could not read terminal input.', error);
            }
            if (text === null || text === '/exit') {
                console.log('Exiting Promptov...');
                break;
            }
            let idea = text.trim();
            if (!idea && lastFailedInput) idea = lastFailedInput;
            if (idea === '/new') {
                session.clear();
                lastFailedInput = null;
                isFirstTurn = true;
                console.log('New session. Previous conversation cleared. Unsent draft discarded.');
                continue;
            }
            validateUserMessage(idea);
            validateLocalIntent(idea, session.snapshot().history.length > 0);
            if (idea !== lastFailedInput) {
                session.clearInterruptions();
            }
            session.addUser(idea);
            submitted = true;
            lastFailedInput = idea;
            const snapshot = session.snapshot();
            if (session.takeTrimmedCount()) {
                console.log('Older messages were removed; the session summary and recent messages are retained.');
            }
            console.log('\nGenerating a response...\n');
            const response = await generatePrompt(idea, snapshot.history, {
                context: snapshot.context,
                interruptions: snapshot.interruptions,
                signal: inputController.signal,
                onPartial: savePartial,
                onWaiting: showWaiting
            });
            session.addModel(response);
            submitted = false;
            lastFailedInput = null;
            console.log(`Promptov:\n${formatAnswer(response)}\n`);
            isFirstTurn = response.type !== 'clarification';
        } catch (error) {
            if (submitted) {
                session.rejectLastUser();
                submitted = false;
            }
            const outcome = getErrorOutcome(error, inputController.signal.aborted);
            console.error(cleanTerminalText(outcome.message));
            if (outcome.action === 'continue' || outcome.action === 'reset') {
                if (outcome.action === 'reset') {
                    isFirstTurn = true;
                }
                continue;
            }
            process.exitCode = outcome.exitCode;
            break;
        }
    }
} finally {
    session.clear();
    terminal.close();
}
