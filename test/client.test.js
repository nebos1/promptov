import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApiClient } from '../api-client.js';
import { emptyContext } from '../history.js';

const history = [{ role: 'user', parts: [{ text: 'A fox in a snowy forest.' }] }];
const reply = { type: 'final', text: 'A watercolor fox in a snowy forest.', context: emptyContext() };

test('sends a validated conversation and reads a finished response', async () => {
    let submitted;
    const client = createApiClient({
        endpoint: 'https://service.test/generate',
        fetchImpl: async (url, options) => {
            assert.equal(url, 'https://service.test/generate');
            submitted = JSON.parse(options.body);
            return Response.json(reply);
        }
    });
    assert.deepEqual(await client('A fox', history), reply);
    assert.deepEqual(submitted.history, history);
    assert.deepEqual(submitted.context, emptyContext());
});

test('handles queued, interrupted, and finished responses in one stream', async () => {
    const events = [
        { event: 'waiting', position: 1 },
        { event: 'partial', partial: { model: 'assistant', text: 'A watercolor', complete: false, stopReason: 'output_limit' } },
        { event: 'reply', response: reply }
    ];
    const client = createApiClient({
        endpoint: 'https://service.test/generate',
        fetchImpl: async () => new Response(events.map(event => JSON.stringify(event)).join('\n') + '\n', {
            headers: { 'Content-Type': 'application/x-ndjson' }
        })
    });
    let position;
    let partial;
    const result = await client('A fox', history, {
        onWaiting: value => { position = value; },
        onPartial: value => { partial = value; }
    });
    assert.equal(position, 1);
    assert.equal(partial.text, 'A watercolor');
    assert.deepEqual(result, reply);
});

test('rejects invalid local input without making a network request', async () => {
    let calls = 0;
    const client = createApiClient({
        endpoint: 'https://service.test/generate',
        fetchImpl: async () => { calls++; return Response.json(reply); }
    });
    await assert.rejects(client('', []));
    assert.equal(calls, 0);
});

test('does not display internal server error details', async () => {
    const client = createApiClient({
        endpoint: 'https://service.test/generate',
        fetchImpl: async () => Response.json({ error: { code: 'INTERNAL_ERROR', message: 'PRIVATE_INTERNAL_DETAILS' } }, { status: 500 })
    });
    await assert.rejects(client('A fox', history), error => {
        assert.doesNotMatch(error.message, /PRIVATE_INTERNAL_DETAILS/);
        assert.match(error.message, /temporarily unavailable/);
        return true;
    });
});

test('the CLI can retry a failed submission with /send', { timeout: 10000 }, async () => {
    const requests = [];
    const server = createServer(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += chunk;
        requests.push(JSON.parse(body));
        response.setHeader('Content-Type', 'application/json');
        if (requests.length === 1) {
            response.writeHead(503);
            response.end(JSON.stringify({ error: { code: 'GENERATION_UNAVAILABLE' } }));
        } else {
            response.end(JSON.stringify({ ...reply, text: 'FINAL_TEST_REPLY' }));
        }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const child = spawn(process.execPath, [fileURLToPath(new URL('../cli.js', import.meta.url))], {
        env: { ...process.env, PROMPTOV_API_URL: `http://127.0.0.1:${server.address().port}/generate` },
        stdio: ['pipe', 'pipe', 'pipe']
    });
    let output = '';
    let errors = '';
    let sent = false;
    let retried = false;
    let exited = false;
    const timer = setTimeout(() => child.kill(), 8000);
    child.stdout.on('data', chunk => {
        output += chunk;
        if (!sent && output.includes('Enter your visual idea.')) {
            sent = true;
            child.stdin.write('A fox in a snowy forest.\n/send\n');
        }
        if (!exited && output.includes('FINAL_TEST_REPLY')) {
            exited = true;
            child.stdin.write('/exit\n');
        }
    });
    child.stderr.on('data', chunk => {
        errors += chunk;
        if (!retried && errors.includes('temporarily unable')) {
            retried = true;
            child.stdin.write('/send\n');
        }
    });
    try {
        const [code] = await once(child, 'exit');
        assert.equal(code, 0, errors);
        assert.equal(requests.length, 2);
        assert.deepEqual(requests[0].history, requests[1].history);
        assert.match(output, /FINAL_TEST_REPLY/);
    } finally {
        clearTimeout(timer);
        child.kill();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
});
