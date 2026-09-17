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
