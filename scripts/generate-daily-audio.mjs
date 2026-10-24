import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Keep both existing explicit-date generators inside one shared engine session.
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--date' || !/^\d{4}-\d{2}-\d{2}$/.test(args[1])) {
  throw new Error('Use --date YYYY-MM-DD; historical/all/force generation is not a daily batch');
}
const commands = ['generate-japanese-audio.mjs', 'generate-interview-audio.mjs']
  .map(name => [process.execPath, fileURLToPath(new URL(name, import.meta.url)), '--date', args[1]]);
const child = spawn('python3', [fileURLToPath(new URL('aivis-session.py', import.meta.url)),
  '--commands-json', JSON.stringify(commands)], { stdio: 'inherit' });
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('close', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
