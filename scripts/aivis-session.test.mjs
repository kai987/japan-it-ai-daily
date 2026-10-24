import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('shared local AivisSpeech recording lifecycle', () => {
  it('passes shutdown, interrupted recording and actual OS-lock regression tests', () => {
    const output = execFileSync('python3', ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'aivis_session_test.py'], { encoding: 'utf8', stdio: 'pipe' });
    expect(output).toBe('');
  });

  it.each([[], ['--latest'], ['--all'], ['--date', 'invalid'], ['--date', '2026-10-24', '--force']].map(args => ({ args })))('refuses a non-explicit-date batch: $args', ({ args }) => {
    const result = spawnSync(process.execPath, ['scripts/generate-daily-audio.mjs', ...args], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Use --date YYYY-MM-DD');
  });

  it('keeps the existing generator order and explicit date inside the shared session', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aivis-batch-'));
    try {
      const output = join(directory, 'arguments.json');
      const interpreter = join(directory, 'python3');
      writeFileSync(interpreter, `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(output)}, JSON.stringify(process.argv.slice(2)));\n`);
      chmodSync(interpreter, 0o700);
      execFileSync(process.execPath, ['scripts/generate-daily-audio.mjs', '--date', '2026-10-24'], {
        env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
      });
      const [helper, option, argument] = JSON.parse(readFileSync(output, 'utf8'));
      expect(helper).toMatch(/\/aivis-session\.py$/);
      expect(option).toBe('--commands-json');
      const commands = JSON.parse(argument);
      expect(commands.map(command => command.slice(-2))).toEqual([
        ['--date', '2026-10-24'], ['--date', '2026-10-24'],
      ]);
      expect(commands.map(command => command[1].split('/').at(-1))).toEqual([
        'generate-japanese-audio.mjs', 'generate-interview-audio.mjs',
      ]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
