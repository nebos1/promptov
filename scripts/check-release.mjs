import { readFile } from 'node:fs/promises';
import { DEFAULT_API_URL } from '../config.js';

try {
    const url = new URL(DEFAULT_API_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/generate' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.hostname.includes('example') || url.hostname.startsWith('your-')) throw new Error();
    const cli = await readFile(new URL('../cli.js', import.meta.url), 'utf8');
    if (!cli.startsWith('#!/usr/bin/env node\n')) throw new Error();
    console.log('Release configuration checked.');
} catch {
    console.error('Release blocked: configure the real HTTPS backend address with npm run configure-api -- https://YOUR-REAL-SERVICE/generate');
    process.exitCode = 1;
}
