import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { annotateAudioFileVersions, synchronizeAudioFileVersions } from './audio-file-versions.mjs';

const roots = [];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'audio-versions-'));
  roots.push(root);
  for (const date of ['2026-09-18', '2026-09-19', '2026-09-20']) mkdirSync(join(root, date));
  writeFileSync(join(root, '2026-09-18', 'vocab-01.mp3'), 'original word bytes');
  writeFileSync(join(root, '2026-09-18', 'example-01.mp3'), 'original example bytes');
  return root;
};
const save = (root, date, manifest) => writeFileSync(join(root, date, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const read = (root, date) => JSON.parse(readFileSync(join(root, date, 'manifest.json')));
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe('MP3 byte versions', () => {
  it('uses actual source bytes for review vocabulary, grammar and interview without changing synthesis metadata', () => {
    const root = fixture();
    const manifest = {
      date: '2026-09-19', generatedAt: 'unchanged', voice: { name: 'morioki', style: 'ノーマル' },
      items: [{ term: '語', audioDate: '2026-09-18', word: 'vocab-01.mp3', wordHash: 'task-hash', example: 'example-01.mp3' }],
      grammar: [{ audioDate: '2026-09-18', example: 'example-01.mp3', exampleHash: 'grammar-task' }],
      interview: [{ audioDate: '2026-09-18', audio: 'example-01.mp3', audioHash: 'interview-task' }],
      review: [{ audioDate: '2026-09-18', audio: 'vocab-01.mp3' }],
    };
    const original = structuredClone(manifest);
    expect(annotateAudioFileVersions(manifest, root)).toBe(5);
    expect(manifest.items[0].wordSha256).toBe(sha('original word bytes'));
    expect(manifest.items[0].exampleSha256).toBe(sha('original example bytes'));
    expect(manifest.grammar[0].exampleSha256).toBe(sha('original example bytes'));
    expect(manifest.interview[0].audioSha256).toBe(sha('original example bytes'));
    expect(manifest.review[0].audioSha256).toBe(sha('original word bytes'));
    const stripVersions = (value) => JSON.parse(JSON.stringify(value), (key, val) => key.endsWith('Sha256') ? undefined : val);
    expect(stripVersions(manifest)).toEqual(original);
  });

  it('is repeatable, checks without writing, and updates later references when bytes change at the same URL', () => {
    const root = fixture();
    save(root, '2026-09-18', { date: '2026-09-18', items: [{ word: 'vocab-01.mp3', wordHash: 'stable-task' }] });
    save(root, '2026-09-19', { date: '2026-09-19', items: [{ audioDate: '2026-09-18', word: 'vocab-01.mp3' }] });
    expect(synchronizeAudioFileVersions(root, { check: true }).changed).toHaveLength(2);
    expect(read(root, '2026-09-18').items[0].wordSha256).toBeUndefined();
    expect(synchronizeAudioFileVersions(root).changed).toHaveLength(2);
    expect(synchronizeAudioFileVersions(root).changed).toHaveLength(0);
    writeFileSync(join(root, '2026-09-18', 'vocab-01.mp3'), 'replacement bytes');
    expect(synchronizeAudioFileVersions(root, { check: true }).changed).toHaveLength(2);
    synchronizeAudioFileVersions(root);
    for (const date of ['2026-09-18', '2026-09-19']) expect(read(root, date).items[0].wordSha256).toBe(sha('replacement bytes'));
    expect(read(root, '2026-09-18').items[0].wordHash).toBe('stable-task');
  });

  it('skips browser-only speech but fails before any writes for a missing file or malformed manifest', () => {
    const root = fixture();
    expect(annotateAudioFileVersions({ date: '2026-09-18', items: [{ playback: 'browser-tts', word: null, example: null }] }, root)).toBe(0);
    save(root, '2026-09-18', { date: '2026-09-18', items: [{ word: 'vocab-01.mp3' }] });
    save(root, '2026-09-19', { date: '2026-09-19', items: [{ word: 'missing.mp3' }] });
    expect(() => synchronizeAudioFileVersions(root)).toThrow();
    expect(read(root, '2026-09-18').items[0].wordSha256).toBeUndefined();
    writeFileSync(join(root, '2026-09-19', 'manifest.json'), '{invalid');
    expect(() => synchronizeAudioFileVersions(root)).toThrow();
  });
});
