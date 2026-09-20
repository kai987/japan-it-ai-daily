import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, expect } from 'vitest';
import { collectAudioAssets, selectRemoteAssets } from './verify-audio-integrity.mjs';
import { audioManifestState } from './audio-manifest-state.mjs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { versionedAudioKey } from '../src/lib/audioVersion.mjs';

function copyPolicy(root) {
  mkdirSync(join(root, 'docs'), { recursive: true });
  cpSync('docs/structured-interview-policy.json', join(root, 'docs/structured-interview-policy.json'));
}

function copyReferencedReviewAudio(root, learning, currentDate) {
  const refs = [
    ...(learning.items || []).filter((item) => item.studyKind === 'review').flatMap((item) =>
      [item.word, item.example].filter(Boolean).map((filename) => ({ audioDate: item.audioDate, filename }))),
    ...(learning.grammar || []).filter((item) => item.studyKind === 'review').flatMap((item) =>
      [item.example].filter(Boolean).map((filename) => ({ audioDate: item.audioDate, filename }))),
  ];
  for (const { audioDate, filename } of refs) {
    if (!audioDate || audioDate === currentDate) continue;
    const source = join('public/audio/japanese', audioDate, filename);
    const destinationDir = join(root, 'public/audio/japanese', audioDate);
    mkdirSync(destinationDir, { recursive: true });
    cpSync(source, join(destinationDir, filename));
  }
}

test('plain-format daily audio passes and stale Japanese text is rejected', () => {
  const root = mkdtempSync(join(tmpdir(), 'daily-audio-integrity-'));
  const date = '2026-09-11';
  try {
    copyPolicy(root);
    for (const dir of ['daily', 'daily-ja', 'japanese', 'japanese-ja']) {
      mkdirSync(join(root, 'src/content', dir), { recursive: true });
      cpSync(`src/content/${dir}/${date}.md`, join(root, 'src/content', dir, `${date}.md`));
    }
    const audio = `public/audio/japanese/${date}`;
    mkdirSync(join(root, audio), { recursive: true });
    cpSync(audio, join(root, audio), { recursive: true });
    const learning = JSON.parse(readFileSync(`${audio}/manifest.json`, 'utf8'));
    copyReferencedReviewAudio(root, learning, date);
    const interview = JSON.parse(readFileSync(`${audio}/interview-manifest.json`, 'utf8'));
    const expectedAssets = (interview.interview?.length ?? 0) + (interview.review?.length ?? 0)
      + learning.items.filter((item) => item.playback !== 'browser-tts').length * 2
      + learning.grammar.filter((item) => item.playback !== 'browser-tts').length;
    expect(collectAudioAssets(root).assets.size).toBe(expectedAssets);
    writeFileSync(join(root, audio, 'unused-legacy.mp3'), 'retained legacy recording');
    const withLegacy = collectAudioAssets(root);
    const legacyKey = `japanese/${date}/unused-legacy.mp3`;
    expect(withLegacy.assets.has(legacyKey)).toBe(false);
    expect(selectRemoteAssets(withLegacy).has(legacyKey)).toBe(true);
    expect(selectRemoteAssets(withLegacy, [`${audio}/manifest.json`], root).has(legacyKey)).toBe(false);
    expect(selectRemoteAssets(withLegacy, [`${audio}/vocab-01.mp3`], root).size).toBe(1);
    const path = join(root, 'src/content/daily-ja', `${date}.md`);
    const manifest = JSON.parse(readFileSync(`${audio}/interview-manifest.json`, 'utf8'));
    const answer = manifest.interview.find((item) => item.type === 'answer').text;
    const source = readFileSync(path, 'utf8');
    expect(source).toContain(answer);
    writeFileSync(path, source.replace(answer, '変更された回答です。'));
    expect(() => collectAudioAssets(root)).toThrow('daily-ja/2026-09-11 interview: content/audio mapping mismatch');
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('review entries reuse first-introduced recordings instead of creating duplicate MP3 files', () => {
  const root = mkdtempSync(join(tmpdir(), 'daily-review-audio-integrity-'));
  const date = '2026-09-11';
  const sourceDate = '2026-08-12';
  try {
    copyPolicy(root);
    for (const dir of ['daily', 'daily-ja', 'japanese', 'japanese-ja']) {
      mkdirSync(join(root, 'src/content', dir), { recursive: true });
      cpSync(`src/content/${dir}/${date}.md`, join(root, 'src/content', dir, `${date}.md`));
    }
    const audio = `public/audio/japanese/${date}`;
    mkdirSync(join(root, audio), { recursive: true });
    cpSync(audio, join(root, audio), { recursive: true });

    const sourceAudio = join(root, 'public/audio/japanese', sourceDate);
    mkdirSync(sourceAudio, { recursive: true });
    for (const name of ['vocab-07.mp3', 'example-07.mp3', 'grammar-example-02.mp3']) {
      writeFileSync(join(sourceAudio, name), Buffer.from([1,2,3]));
    }

    const manifestPath = join(root, audio, 'manifest.json');
    const learning = JSON.parse(readFileSync(manifestPath, 'utf8'));
    copyReferencedReviewAudio(root, learning, date);
    learning.items.push({
      index: 1,
      studyKind: 'review',
      identity: '検証する',
      firstIntroducedDate: sourceDate,
      audioDate: sourceDate,
      term: '検証する',
      reading: 'けんしょうする',
      exampleJa: '実データで検証します。',
      word: 'vocab-07.mp3',
      example: 'example-07.mp3',
    });
    learning.grammar.push({
      index: 1,
      studyKind: 'review',
      identity: 'わけではない',
      firstIntroducedDate: sourceDate,
      audioDate: sourceDate,
      pattern: '～わけではない',
      exampleJa: 'すべてに当てはまるわけではない。',
      example: 'grammar-example-02.mp3',
    });
    writeFileSync(manifestPath, JSON.stringify(learning, null, 2));

    const result = collectAudioAssets(root);
    expect(result.assets.has(`japanese/${sourceDate}/vocab-07.mp3`)).toBe(true);
    expect(result.assets.has(`japanese/${sourceDate}/example-07.mp3`)).toBe(true);
    expect(result.assets.has(`japanese/${sourceDate}/grammar-example-02.mp3`)).toBe(true);
    expect([...result.assets.keys()].some((path) => /\/(?:review-vocab|review-example|review-grammar-example)-\d+\.mp3$/.test(path))).toBe(false);

    learning.items.at(-1).word = 'review-vocab-01.mp3';
    writeFileSync(manifestPath, JSON.stringify(learning, null, 2));
    expect(() => collectAudioAssets(root)).toThrow('duplicated review vocabulary recording');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('pending audio is reported, but partial generation and missing cross-date recordings fail', () => {
  const root = mkdtempSync(join(tmpdir(), 'audio-pending-'));
  const date = '2026-09-11';
  try {
    copyPolicy(root);
    for (const dir of ['daily', 'daily-ja', 'japanese', 'japanese-ja']) {
      mkdirSync(join(root, 'src/content', dir), { recursive: true });
      cpSync(`src/content/${dir}/${date}.md`, join(root, 'src/content', dir, `${date}.md`));
    }
    expect(collectAudioAssets(root).pendingDates).toEqual([date]);
    expect(collectAudioAssets(root).assets.size).toBe(0);
    const duration = spawnSync(process.execPath, [resolve('scripts/validate-interview-audio-duration.mjs'), '--date', date], { cwd: root, encoding: 'utf8' });
    expect(duration.status, duration.stderr).toBe(0);
    expect(duration.stdout).toContain(`Audio not generated yet (optional): ${date}`);

    const directory = join(root, 'public/audio/japanese', date);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'vocab-01.mp3'), 'orphan');
    expect(() => audioManifestState(root, date)).toThrow('incomplete audio generation');
    rmSync(join(directory, 'vocab-01.mp3'));
    cpSync(`public/audio/japanese/${date}/manifest.json`, join(directory, 'manifest.json'));
    expect(() => collectAudioAssets(root)).toThrow('interview-manifest.json');
    const brokenDuration = spawnSync(process.execPath, [resolve('scripts/validate-interview-audio-duration.mjs'), '--date', date], { cwd: root, encoding: 'utf8' });
    expect(brokenDuration.status).not.toBe(0);
    expect(brokenDuration.stderr).toContain('interview-manifest.json');

    cpSync(`public/audio/japanese/${date}`, directory, { recursive: true });
    const learning = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
    copyReferencedReviewAudio(root, learning, date);
    learning.items.push({ ...learning.items[0], studyKind: 'review', identity: 'cross-date-review',
      firstIntroducedDate: '2026-08-12', audioDate: '2026-08-12', word: 'vocab-99.mp3', example: 'example-99.mp3' });
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify(learning));
    expect(() => collectAudioAssets(root)).toThrow('vocab-99.mp3');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('changed manifest checks its cross-date references; changed MP3 does not download unrelated history', () => {
  const a = 'japanese/2026-09-11/interview-answer-01.mp3';
  const review = 'japanese/2026-08-12/vocab-01.mp3';
  const unrelated = 'japanese/2026-08-13/vocab-01.mp3';
  const assets = new Map([a, review, unrelated].map((key) => [key, { size: 3, sha256: 'a'.repeat(64) }]));
  const publicationAssets = new Map([...assets, ['japanese/2026-08-12/unused.mp3', assets.get(a)]]);
  const report = { assets, publicationAssets, assetsByDate: new Map([['2026-09-11', new Set([a, review])]]) };
  const version = (path) => versionedAudioKey(path, 'a'.repeat(64));
  expect([...selectRemoteAssets(report, ['public/audio/japanese/2026-09-11/manifest.json']).keys()]).toEqual([version(a), version(review)]);
  expect([...selectRemoteAssets(report, ['src/content/japanese/2026-09-11.md']).keys()]).toEqual([version(a), version(review)]);
  expect([...selectRemoteAssets(report, [`public/audio/${a}`]).keys()]).toEqual([version(a)]);
  expect(selectRemoteAssets(report, [`public/audio/${a}`]).get(version(a)).sourcePath).toBe(a);
  expect(selectRemoteAssets(report, []).size).toBe(0);
  expect(selectRemoteAssets(report).size).toBe(publicationAssets.size * 2);
  for (const path of publicationAssets.keys()) {
    expect(selectRemoteAssets(report).has(path)).toBe(true);
    expect(selectRemoteAssets(report).has(version(path))).toBe(true);
  }
});

test('actual MP3 version hashes cannot claim stale bytes are current', () => {
  const root = mkdtempSync(join(tmpdir(), 'audio-version-integrity-'));
  const date = '2026-09-11';
  try {
    copyPolicy(root);
    for (const dir of ['daily', 'daily-ja', 'japanese', 'japanese-ja']) {
      mkdirSync(join(root, 'src/content', dir), { recursive: true });
      cpSync(`src/content/${dir}/${date}.md`, join(root, 'src/content', dir, `${date}.md`));
    }
    const directory = join(root, 'public/audio/japanese', date);
    cpSync(`public/audio/japanese/${date}`, directory, { recursive: true });
    copyReferencedReviewAudio(root, JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')), date);
    const path = join(directory, 'interview-manifest.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    manifest.interview[0].audioSha256 = '0'.repeat(64);
    writeFileSync(path, JSON.stringify(manifest));
    expect(() => collectAudioAssets(root)).toThrow('manifest file SHA-256 mismatch');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('structured audio uses the requested checkout and still rejects a changed report mirror', () => {
  const root = mkdtempSync(join(tmpdir(), 'structured-audio-root-'));
  const date = '2026-09-20';
  try {
    copyPolicy(root);
    for (const dir of ['daily', 'daily-ja', 'japanese', 'japanese-ja']) {
      mkdirSync(join(root, 'src/content', dir), { recursive: true });
      cpSync(`src/content/${dir}/${date}.md`, join(root, 'src/content', dir, `${date}.md`));
    }
    const directory = join(root, 'public/audio/japanese', date);
    cpSync(`public/audio/japanese/${date}`, directory, { recursive: true });
    copyReferencedReviewAudio(root, JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')), date);
    expect(() => collectAudioAssets(root)).toThrow('structured interview unavailable');
    mkdirSync(join(root, 'src/data/interviews'), { recursive: true });
    cpSync(`src/data/interviews/${date}.json`, join(root, 'src/data/interviews', `${date}.json`));
    expect(collectAudioAssets(root).dates).toBe(1);
    const record = JSON.parse(readFileSync(join(root, 'src/data/interviews', `${date}.json`), 'utf8'));
    const report = join(root, 'src/content/daily-ja', `${date}.md`);
    writeFileSync(report, readFileSync(report, 'utf8').replace(record.interview[0].answer, 'Changed visible answer.'));
    expect(() => collectAudioAssets(root)).toThrow('interview mirror');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
