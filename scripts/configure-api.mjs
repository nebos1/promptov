import { writeFile } from 'node:fs/promises';

const address = process.argv[2];
try {
    const url = new URL(address);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/generate' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        throw new Error();
    }
    await writeFile(new URL('../config.js', import.meta.url), `export const DEFAULT_API_URL = ${JSON.stringify(url.href)};\n`);
    console.log('Configured the public Promptov service address.');
} catch {
    console.error('Usage: npm run configure-api -- https://YOUR-REAL-SERVICE/generate');
    process.exitCode = 1;
}
