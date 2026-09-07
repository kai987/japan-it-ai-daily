import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { test, expect } from 'vitest';
import { collectAudioAssets, verifyRemoteAssets } from './verify-audio-integrity.mjs';

function fixture(date, check) {
  const root = mkdtempSync(join(tmpdir(), 'daily-gate-'));
  for (const dir of ['daily', 'daily-ja', 'japanese', 'japanese-ja']) {
    mkdirSync(join(root, 'src/content', dir), { recursive: true });
    copyFileSync(`src/content/${dir}/${date}.md`, join(root, 'src/content', dir, `${date}.md`));
  }
  mkdirSync(join(root, 'public'), { recursive: true });
  symlinkSync(resolve('public/audio'), join(root, 'public/audio'), 'dir');
  try { check(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
const quality = (root, ...args) => spawnSync(process.execPath, [resolve('scripts/validate-daily-quality.mjs'), ...args], { cwd: root, encoding: 'utf8' });

test('default quality policy covers repaired history and rejects an empty explicit date', () => {
  fixture('2026-08-12', (root) => {
    const valid = quality(root);
    expect(valid.status, valid.stderr).toBe(0);
    expect(valid.stdout).toContain('2026-08-12: PASS');
    expect(quality(root, '--date=2099-01-01').status).toBe(1);
  });
});

test('a sixth Top article cannot be silently truncated by the validator', () => {
  fixture('2026-08-12', (root) => {
    const path = join(root, 'src/content/daily/2026-08-12.md');
    writeFileSync(path, readFileSync(path, 'utf8').replace('## 2. 分类速览', '### ⑥ 额外文章\n\n这是额外的文章。\n\n## 2. 分类速览'));
    const result = quality(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('实际 6');
  });
});

test('the 9/7 exception applies only to unchanged reviewed source files', () => {
  fixture('2026-09-07', (root) => {
    expect(quality(root).status).toBe(0);
    const path = join(root, 'src/content/daily-ja/2026-09-07.md');
    writeFileSync(path, readFileSync(path, 'utf8') + '\nChanged source.\n');
    expect(quality(root).status).toBe(1);
  });
});

test('audio integrity validates both languages and catches edited answers without regenerated recordings', () => {
  fixture('2026-08-12', (root) => {
    expect(collectAudioAssets(root).dates).toBe(1);
    const manifest = JSON.parse(readFileSync('public/audio/japanese/2026-08-12/interview-manifest.json', 'utf8'));
    const path = join(root, 'src/content/daily-ja/2026-08-12.md');
    writeFileSync(path, readFileSync(path, 'utf8').replace(manifest.interview[1].text, '変更した回答です。'));
    expect(() => collectAudioAssets(root)).toThrow('interview: content/audio mapping mismatch');
  });
});

test('a dated report without an audio directory cannot silently pass', () => {
  const root = mkdtempSync(join(tmpdir(), 'missing-audio-'));
  mkdirSync(join(root, 'src/content/daily'), { recursive: true });
  writeFileSync(join(root, 'src/content/daily/2026-09-08.md'), 'report');
  try {
    const result = spawnSync(process.execPath, [resolve('scripts/validate-interview-audio-duration.mjs'), '--from', '2026-08-12'], { cwd: root, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('interview-manifest.json is missing');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('public audio verification checks bytes, not merely a successful HTTP status', async () => {
  const bytes = Buffer.from('expected audio bytes');
  const assets = new Map([['japanese/test.mp3', { size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }]]);
  expect(await verifyRemoteAssets(assets, 'https://audio.example/', async () => new Response(bytes))).toBe(1);
  await expect(verifyRemoteAssets(assets, 'https://audio.example/', async () => new Response('stale audio'))).rejects.toThrow('SHA-256 mismatch');
  await expect(verifyRemoteAssets(assets, 'https://audio.example/', async () => new Response('', { status: 404 }))).rejects.toThrow('HTTP 404');
});
