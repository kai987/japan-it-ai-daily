import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, expect } from 'vitest';
import { collectAudioAssets } from './verify-audio-integrity.mjs';

test('plain-format daily audio passes and stale Japanese text is rejected', () => {
  const root = mkdtempSync(join(tmpdir(), 'daily-audio-integrity-'));
  const date = '2026-09-11';
  try {
    for (const dir of ['daily', 'daily-ja', 'japanese', 'japanese-ja']) {
      mkdirSync(join(root, 'src/content', dir), { recursive: true });
      cpSync(`src/content/${dir}/${date}.md`, join(root, 'src/content', dir, `${date}.md`));
    }
    const audio = `public/audio/japanese/${date}`;
    mkdirSync(join(root, audio), { recursive: true });
    cpSync(audio, join(root, audio), { recursive: true });
    const learning = JSON.parse(readFileSync(`${audio}/manifest.json`, 'utf8'));
    const interview = JSON.parse(readFileSync(`${audio}/interview-manifest.json`, 'utf8'));
    const expectedAssets = (interview.interview?.length ?? 0) + (interview.review?.length ?? 0)
      + learning.items.filter((item) => item.playback !== 'browser-tts').length * 2
      + learning.grammar.filter((item) => item.playback !== 'browser-tts').length;
    expect(collectAudioAssets(root).assets.size).toBe(expectedAssets);
    const path = join(root, 'src/content/daily-ja', `${date}.md`);
    const manifest = JSON.parse(readFileSync(`${audio}/interview-manifest.json`, 'utf8'));
    const answer = manifest.interview.find((item) => item.type === 'answer').text;
    const source = readFileSync(path, 'utf8');
    expect(source).toContain(answer);
    writeFileSync(path, source.replace(answer, '変更された回答です。'));
    expect(() => collectAudioAssets(root)).toThrow('daily-ja/2026-09-11 interview: content/audio mapping mismatch');
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('learning manifest may append recorded review vocabulary and grammar without changing source NEW arrays', () => {
  const root = mkdtempSync(join(tmpdir(), 'daily-review-audio-integrity-'));
  const date = '2026-09-11';
  try {
    for (const dir of ['daily', 'daily-ja', 'japanese', 'japanese-ja']) {
      mkdirSync(join(root, 'src/content', dir), { recursive: true });
      cpSync(`src/content/${dir}/${date}.md`, join(root, 'src/content', dir, `${date}.md`));
    }
    const audio = `public/audio/japanese/${date}`;
    mkdirSync(join(root, audio), { recursive: true });
    cpSync(audio, join(root, audio), { recursive: true });

    const manifestPath = join(root, audio, 'manifest.json');
    const learning = JSON.parse(readFileSync(manifestPath, 'utf8'));
    learning.items.push({
      index: 1,
      studyKind: 'review',
      identity: '検証する',
      firstIntroducedDate: '2026-08-12',
      term: '検証する',
      reading: 'けんしょうする',
      exampleJa: '実データで検証します。',
      word: 'review-vocab-01.mp3',
      wordHash: 'test',
      example: 'review-example-01.mp3',
      exampleHash: 'test',
    });
    learning.grammar.push({
      index: 1,
      studyKind: 'review',
      identity: 'わけではない',
      firstIntroducedDate: '2026-08-12',
      pattern: '～わけではない',
      exampleJa: 'すべてに当てはまるわけではない。',
      example: 'review-grammar-example-01.mp3',
      exampleHash: 'test',
    });
    writeFileSync(manifestPath, JSON.stringify(learning, null, 2));
    for (const name of ['review-vocab-01.mp3', 'review-example-01.mp3', 'review-grammar-example-01.mp3']) {
      writeFileSync(join(root, audio, name), Buffer.from([1,2,3]));
    }

    const result = collectAudioAssets(root);
    expect(result.assets.has(`japanese/${date}/review-vocab-01.mp3`)).toBe(true);
    expect(result.assets.has(`japanese/${date}/review-example-01.mp3`)).toBe(true);
    expect(result.assets.has(`japanese/${date}/review-grammar-example-01.mp3`)).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
