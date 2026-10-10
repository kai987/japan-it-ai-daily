import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const roots = [];
const servers = [];
const fixture = (dates = ['2026-08-12']) => {
  const root = mkdtempSync(join(tmpdir(), 'audio-generator-cache-'));
  roots.push(root);
  for (const dir of ['daily', 'daily-ja', 'japanese', 'japanese-ja']) {
    mkdirSync(join(root, 'src/content', dir), { recursive: true });
    for (const date of dates) cpSync(`src/content/${dir}/${date}.md`, join(root, 'src/content', dir, `${date}.md`));
  }
  for (const path of ['docs/jlpt-history/identity-rules.json', 'docs/grammar-history/identity-rules.json', 'docs/structured-interview-policy.json']) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    cpSync(path, join(root, path));
  }
  for (const date of dates) cpSync(`public/audio/japanese/${date}`, join(root, 'public/audio/japanese', date), { recursive: true });
  return root;
};

const engine = async ({ allowSynthesis = false } = {}) => {
  const requests = [];
  const wav = Buffer.alloc(44 + 2400 * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24);
  wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < 2400; i += 1) wav.writeInt16LE(Math.round(3000 * Math.sin(i * 2 * Math.PI * 440 / 24000)), 44 + i * 2);
  const server = createServer((request, response) => {
    requests.push(request.url);
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/speakers') {
      response.end(JSON.stringify([{ name: 'morioki', speaker_uuid: '396a746d-742f-4e43-b722-1182a7fab9af', version: '1.0.0', styles: [{ name: 'ノーマル', id: 497929760 }] }]));
    } else if (allowSynthesis && request.url.startsWith('/audio_query?')) {
      response.end('{}');
    } else if (allowSynthesis && request.url.startsWith('/synthesis?')) {
      response.setHeader('Content-Type', 'audio/wav');
      response.end(wav);
    } else {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: 'Unexpected synthesis in a cache regression test' }));
    }
  });
  servers.push(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { requests, url: `http://127.0.0.1:${server.address().port}` };
};

const runGenerator = (root, script, date, url, extraArgs = []) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [resolvePath(script), '--date', date, ...extraArgs], {
    cwd: root,
    env: { ...process.env, AIVIS_ENGINE_URL: url, AIVIS_STYLE_ID: '497929760', AIVIS_WORD_SPEED: '1.00', AIVIS_EXAMPLE_SPEED: '1.00', AIVIS_INTERVIEW_SPEED: '1.00' },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', (status) => resolve({ status, stdout, stderr }));
});
const resolvePath = (script) => resolve('scripts', script);

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

describe('generator byte integrity before cache reuse', () => {
  it.each([
    ['generate-japanese-audio.mjs', 'manifest.json', 'vocab-01.mp3', 'vocab-02.mp3'],
    ['generate-interview-audio.mjs', 'interview-manifest.json', 'interview-question-01.mp3', 'interview-question-02.mp3'],
  ])('%s rejects another valid MP3 at the cached path without changing the manifest', async (script, manifestName, recording, replacement) => {
    const root = fixture();
    const date = '2026-08-12';
    const directory = join(root, 'public/audio/japanese', date);
    const manifestPath = join(directory, manifestName);
    const original = readFileSync(manifestPath, 'utf8');
    const filePath = join(directory, recording);
    cpSync(join(directory, replacement), filePath);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath], { encoding: 'utf8' });
    expect(probe.status, probe.stderr).toBe(0);
    expect(Number(probe.stdout)).toBeGreaterThan(0);
    const mock = await engine();
    const result = await runGenerator(root, script, date, mock.url);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`${filePath}: recorded file SHA-256 mismatch`);
    expect(readFileSync(manifestPath, 'utf8')).toBe(original);
    expect(mock.requests).toEqual(['/speakers']);
  });

  it.each(['generate-japanese-audio.mjs', 'generate-interview-audio.mjs'])('%s reuses valid cached bytes without synchronizing unrelated damaged history', async (script) => {
    const root = fixture();
    const badDirectory = join(root, 'public/audio/japanese/2026-08-13');
    mkdirSync(badDirectory);
    writeFileSync(join(badDirectory, 'bad.mp3'), 'damaged historical bytes');
    const historicalManifest = JSON.stringify({ date: '2026-08-13', items: [{ word: 'bad.mp3', wordSha256: 'f'.repeat(64) }] });
    writeFileSync(join(badDirectory, 'manifest.json'), historicalManifest);
    const mock = await engine();
    const result = await runGenerator(root, script, '2026-08-12', mock.url);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('生成/更新：0 个 MP3');
    expect(mock.requests).toEqual(['/speakers']);
    expect(readFileSync(join(badDirectory, 'manifest.json'), 'utf8')).toBe(historicalManifest);
  });

  it('learning generation verifies historical review source bytes before annotating them', async () => {
    const root = fixture(['2026-08-12', '2026-08-13']);
    // The second day reviews the first day's grammar recording.
    const manifestPath = join(root, 'public/audio/japanese/2026-08-13/manifest.json');
    const original = readFileSync(manifestPath, 'utf8');
    const review = JSON.parse(original).grammar.find((item) => item.studyKind === 'review');
    const sourcePath = join(root, 'public/audio/japanese', review.audioDate, review.example);
    cpSync(join(root, 'public/audio/japanese/2026-08-12/grammar-example-02.mp3'), sourcePath);
    const mock = await engine();
    const result = await runGenerator(root, 'generate-japanese-audio.mjs', '2026-08-13', mock.url);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`${sourcePath}: recorded file SHA-256 mismatch`);
    expect(readFileSync(manifestPath, 'utf8')).toBe(original);
    expect(mock.requests).toEqual(['/speakers']);
  });

  it('explicit force regenerates the requested date and updates only its trusted dependent references', async () => {
    const root = fixture();
    const directory = join(root, 'public/audio/japanese/2026-08-12');
    const original = JSON.parse(readFileSync(join(directory, 'interview-manifest.json'), 'utf8'));
    const recording = original.interview[0];
    const filePath = join(directory, recording.audio);
    writeFileSync(filePath, 'damaged bytes requiring explicit repair');
    const dependentDirectory = join(root, 'public/audio/japanese/2026-08-13');
    mkdirSync(dependentDirectory);
    const dependentPath = join(dependentDirectory, 'interview-manifest.json');
    writeFileSync(dependentPath, JSON.stringify({ date: '2026-08-13', review: [{ audioDate: '2026-08-12', audio: recording.audio, audioSha256: recording.audioSha256 }] }));
    const unrelatedDirectory = join(root, 'public/audio/japanese/2026-08-14');
    mkdirSync(unrelatedDirectory);
    const unrelatedPath = join(unrelatedDirectory, 'manifest.json');
    const unrelated = JSON.stringify({ date: '2026-08-14', items: [{ word: 'bad.mp3', wordSha256: 'f'.repeat(64) }] });
    writeFileSync(unrelatedPath, unrelated);
    writeFileSync(join(unrelatedDirectory, 'bad.mp3'), 'other damaged bytes');
    const mock = await engine({ allowSynthesis: true });
    const result = await runGenerator(root, 'generate-interview-audio.mjs', '2026-08-12', mock.url, ['--force']);
    expect(result.status, result.stderr).toBe(0);
    const regenerated = JSON.parse(readFileSync(join(directory, 'interview-manifest.json'), 'utf8')).interview[0];
    expect(regenerated.audioSha256).not.toBe(recording.audioSha256);
    expect(JSON.parse(readFileSync(dependentPath, 'utf8')).review[0].audioSha256).toBe(regenerated.audioSha256);
    expect(readFileSync(unrelatedPath, 'utf8')).toBe(unrelated);
    expect(readFileSync(join(unrelatedDirectory, 'bad.mp3'), 'utf8')).toBe('other damaged bytes');
    expect(mock.requests.filter((path) => path.startsWith('/synthesis?'))).toHaveLength(original.interview.length + original.review.length);
  });
});
