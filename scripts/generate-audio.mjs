import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { constants } from 'node:os';
import { fileURLToPath } from 'node:url';

const usage = 'Use [--date YYYY-MM-DD | --latest | --all] [--interview-only] [--force]';

// Manual compatibility entry; scheduled publication keeps its strict --date entry.
export function manualAudioCommands(args) {
  let selector;
  let force = false;
  let interviewOnly = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (['--date', '--latest', '--all'].includes(argument)) {
      if (selector) throw new Error(`Conflicting or repeated date selection. ${usage}`);
      if (argument === '--date') {
        const date = args[++index];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') ||
            !Number.isFinite(Date.parse(`${date}T00:00:00.000Z`)) ||
            new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
          throw new Error(`Invalid or missing date. ${usage}`);
        }
        selector = ['--date', date];
      } else selector = [argument];
    } else if (argument === '--force' && !force) force = true;
    else if (argument === '--interview-only' && !interviewOnly) interviewOnly = true;
    else throw new Error(`Unknown or repeated argument: ${argument}. ${usage}`);
  }
  selector ||= ['--latest'];
  const generatorArgs = [...selector, ...(force ? ['--force'] : [])];
  const generators = interviewOnly ? ['generate-interview-audio.mjs'] :
    ['generate-japanese-audio.mjs', 'generate-interview-audio.mjs'];
  return [
    ...generators.map(name => [process.execPath, fileURLToPath(new URL(name, import.meta.url)), ...generatorArgs]),
    [process.execPath, fileURLToPath(new URL('validate-interview-audio-duration.mjs', import.meta.url)), ...selector, '--write'],
  ];
}

export function generateManualAudio(args) {
  // Validate every option before starting the engine or acquiring its session.
  const commands = manualAudioCommands(args);
  const child = spawn('python3', [fileURLToPath(new URL('aivis-session.py', import.meta.url)),
    '--commands-json', JSON.stringify(commands)], { stdio: 'inherit' });
  let startFailed = false;
  child.once('error', error => {
    startFailed = true;
    console.error(error.message);
    process.exitCode = 1;
  });
  child.once('close', (code, signal) => {
    if (!startFailed) process.exitCode = code ?? (128 + (constants.signals[signal] || 0));
  });
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { generateManualAudio(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
