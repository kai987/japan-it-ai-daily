import { preview } from 'astro';

// Keep the server in the Playwright process tree; the CLI may auto-background
// itself in agent environments, which Playwright treats as premature exit.
const server = await preview({ server: { host: '127.0.0.1', port: 4321 } });
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => { await server.stop(); process.exit(0); });
}
