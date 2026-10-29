import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const roots = [];
const root = resolve('.');
const wrapper = resolve('scripts/generate-audio.mjs');
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'manual audio session-'));
  roots.push(directory);
  const output = join(directory, 'literal arguments.json');
  const interpreter = join(directory, 'python3');
  writeFileSync(interpreter, `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(output)}, JSON.stringify(process.argv.slice(2)));\nif (process.env.AIVIS_TEST_EXIT === 'SIGTERM') process.kill(process.pid, 'SIGTERM');\nelse process.exit(Number(process.env.AIVIS_TEST_EXIT || 0));\n`);
  chmodSync(interpreter, 0o700);
  const env = { ...process.env, PATH: `${directory}:${process.env.PATH}` };
  return { directory, output, env };
};
const captured = output => {
  const [helper, option, commands] = JSON.parse(readFileSync(output, 'utf8'));
  expect(basename(helper)).toBe('aivis-session.py');
  expect(option).toBe('--commands-json');
  return { helper, commands: JSON.parse(commands) };
};
afterEach(() => roots.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));

describe('managed manual recording commands', () => {
  it.each([
    ['audio:generate', ['--latest'], false, false],
    ['audio:generate:latest', ['--latest'], false, false],
    ['audio:generate:all', ['--all'], false, false],
    ['audio:generate:all:force', ['--all'], true, false],
    ['audio:generate:interview:latest', ['--latest'], false, true],
    ['audio:generate:interview:all', ['--all'], false, true],
    ['audio:generate:interview:all:force', ['--all'], true, true],
  ])('%s keeps its scope and duration writer in one shared session', (script, selector, force, interviewOnly) => {
    const { output, env } = fixture();
    const result = spawnSync('npm', ['run', '--silent', script], { cwd: root, env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const { commands } = captured(output);
    expect(commands.map(command => command[0])).toEqual(Array(interviewOnly ? 2 : 3).fill(process.execPath));
    expect(commands.map(command => basename(command[1]))).toEqual([
      ...(!interviewOnly ? ['generate-japanese-audio.mjs'] : []),
      'generate-interview-audio.mjs', 'validate-interview-audio-duration.mjs',
    ]);
    for (const command of commands.slice(0, -1)) expect(command.slice(2)).toEqual([...selector, ...(force ? ['--force'] : [])]);
    expect(commands.at(-1).slice(2)).toEqual([...selector, '--write']);
  });

  it('accepts a frozen manual date through the existing default npm entry', () => {
    const { output, env } = fixture();
    const result = spawnSync('npm', ['run', '--silent', 'audio:generate', '--', '--date', '2026-10-29'], { cwd: root, env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const { commands } = captured(output);
    expect(commands.map(command => command.slice(2))).toEqual([
      ['--date', '2026-10-29'], ['--date', '2026-10-29'], ['--date', '2026-10-29', '--write'],
    ]);
  });

  it('supports explicit-date interview-only force without forwarding force to duration validation', () => {
    const { output, env } = fixture();
    const result = spawnSync(process.execPath, [wrapper, '--interview-only', '--date', '2024-02-29', '--force'], { env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const { commands } = captured(output);
    expect(commands.map(command => command.slice(2))).toEqual([
      ['--date', '2024-02-29', '--force'], ['--date', '2024-02-29', '--write'],
    ]);
  });

  it.each([
    ['--unknown'], ['--date'], ['--date', '--force'], ['--date', 'invalid'],
    ['--date', '2026-02-29'], ['--date', '2026-13-01'],
    ['--latest', '--all'], ['--date', '2026-10-29', '--latest'],
    ['--date', '2026-10-29', '--date', '2026-10-29'], ['--latest', '--latest'],
    ['--force', '--force'], ['--interview-only', '--interview-only'],
    ['--date', '$(touch should-never-run)'],
  ].map(args => ({ args })))('rejects invalid arguments before starting any session: $args', ({ args }) => {
    const { output, env } = fixture();
    const result = spawnSync(process.execPath, [wrapper, ...args], { env, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Use [--date');
    expect(existsSync(output)).toBe(false);
  });

  it('passes paths containing spaces and quotes as literal JSON argument arrays', () => {
    const { directory, output, env } = fixture();
    const scripts = join(directory, 'folder with "quotes" and apostrophe\'');
    mkdirSync(scripts);
    const copiedWrapper = join(scripts, 'generate-audio.mjs');
    copyFileSync(wrapper, copiedWrapper);
    const result = spawnSync(process.execPath, [copiedWrapper, '--date', '2026-10-29'], { env, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
    const { helper, commands } = captured(output);
    const actualDirectory = realpathSync(scripts);
    expect(helper).toBe(join(actualDirectory, 'aivis-session.py'));
    expect(commands[0]).toEqual([process.execPath, join(actualDirectory, 'generate-japanese-audio.mjs'), '--date', '2026-10-29']);
  });

  it.each([7, 75])('preserves shared-session failure or busy exit status %s', exit => {
    const { env } = fixture();
    const result = spawnSync(process.execPath, [wrapper, '--date', '2026-10-29'], { env: { ...env, AIVIS_TEST_EXIT: String(exit) }, encoding: 'utf8' });
    expect(result.status).toBe(exit);
  });

  it('reports a terminated session as failure', () => {
    const { env } = fixture();
    const result = spawnSync(process.execPath, [wrapper, '--date', '2026-10-29'], { env: { ...env, AIVIS_TEST_EXIT: 'SIGTERM' }, encoding: 'utf8' });
    expect(result.status).toBe(143);
  });

  it('reports a missing session interpreter as failure', () => {
    const directory = mkdtempSync(join(tmpdir(), 'no-audio-interpreter-'));
    roots.push(directory);
    const result = spawnSync(process.execPath, [wrapper, '--date', '2026-10-29'], { env: { ...process.env, PATH: directory }, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ENOENT');
  });
});
