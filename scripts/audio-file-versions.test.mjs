import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { annotateAudioFileVersions, synchronizeAudioFileVersions, verifiedManifestAudioFileVersion } from './audio-file-versions.mjs';

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

  it('explicitly backfills absent hashes without writing in check mode, then rejects changed recorded bytes', () => {
    const root = fixture();
    save(root, '2026-09-18', { date: '2026-09-18', items: [{ word: 'vocab-01.mp3', wordHash: 'stable-task' }] });
    save(root, '2026-09-19', { date: '2026-09-19', items: [{ audioDate: '2026-09-18', word: 'vocab-01.mp3' }] });
    expect(synchronizeAudioFileVersions(root, { check: true }).changed).toHaveLength(2);
    expect(read(root, '2026-09-18').items[0].wordSha256).toBeUndefined();
    expect(synchronizeAudioFileVersions(root).changed).toHaveLength(2);
    expect(synchronizeAudioFileVersions(root).changed).toHaveLength(0);
    writeFileSync(join(root, '2026-09-18', 'vocab-01.mp3'), 'replacement bytes');
    expect(() => synchronizeAudioFileVersions(root, { check: true })).toThrow('vocab-01.mp3: recorded file SHA-256 mismatch');
    expect(() => synchronizeAudioFileVersions(root)).toThrow('vocab-01.mp3: recorded file SHA-256 mismatch');
    for (const date of ['2026-09-18', '2026-09-19']) expect(read(root, date).items[0].wordSha256).toBe(sha('original word bytes'));
    expect(read(root, '2026-09-18').items[0].wordHash).toBe('stable-task');
  });

  it('updates only references to a recording explicitly regenerated from its old trusted hash', () => {
    const root = fixture();
    const previousSha256 = sha('original word bytes');
    save(root, '2026-09-18', { date: '2026-09-18', items: [{ word: 'vocab-01.mp3', wordSha256: previousSha256 }] });
    save(root, '2026-09-19', { date: '2026-09-19', items: [{ audioDate: '2026-09-18', word: 'vocab-01.mp3', wordSha256: previousSha256 }] });
    // Unrelated damaged history must not acquire a trusted hash during this run.
    save(root, '2026-09-20', { date: '2026-09-20', items: [{ word: 'bad.mp3', wordSha256: 'f'.repeat(64) }] });
    writeFileSync(join(root, '2026-09-20', 'bad.mp3'), 'damaged unrelated bytes');
    const unrelatedBefore = readFileSync(join(root, '2026-09-20', 'manifest.json'), 'utf8');
    writeFileSync(join(root, '2026-09-18', 'vocab-01.mp3'), 'new synthesis bytes');
    const regenerated = new Map([['2026-09-18/vocab-01.mp3', { previousSha256, sha256: sha('new synthesis bytes') }]]);
    expect(synchronizeAudioFileVersions(root, { regenerated }).changed).toHaveLength(2);
    for (const date of ['2026-09-18', '2026-09-19']) expect(read(root, date).items[0].wordSha256).toBe(sha('new synthesis bytes'));
    expect(readFileSync(join(root, '2026-09-20', 'manifest.json'), 'utf8')).toBe(unrelatedBefore);
    expect(synchronizeAudioFileVersions(root, { regenerated: new Map() }).changed).toEqual([]);
  });

  it('does not overwrite contradictory review evidence or partially annotate a damaged manifest', () => {
    const root = fixture();
    const manifest = { date: '2026-09-19', items: [{ audioDate: '2026-09-18', word: 'vocab-01.mp3', wordSha256: sha('original word bytes'), example: 'example-01.mp3', exampleSha256: 'f'.repeat(64) }] };
    const original = structuredClone(manifest);
    expect(() => annotateAudioFileVersions(manifest, root)).toThrow('example-01.mp3: recorded file SHA-256 mismatch');
    expect(manifest).toEqual(original);
    const regenerated = new Map([['2026-09-18/example-01.mp3', { previousSha256: sha('original example bytes'), sha256: sha('original example bytes') }]]);
    expect(() => annotateAudioFileVersions(manifest, root, { regenerated })).toThrow('SHA-256 mismatch');
    expect(manifest).toEqual(original);
  });

  it('does not backfill an unrelated unversioned file in a dependent manifest during generation', () => {
    const root = fixture();
    const previousSha256 = sha('original word bytes');
    save(root, '2026-09-18', { date: '2026-09-18', items: [{ word: 'vocab-01.mp3', wordSha256: previousSha256 }] });
    save(root, '2026-09-19', { date: '2026-09-19', items: [{ audioDate: '2026-09-18', word: 'vocab-01.mp3', wordSha256: previousSha256, example: 'example-01.mp3' }] });
    writeFileSync(join(root, '2026-09-18', 'vocab-01.mp3'), 'new synthesis bytes');
    const regenerated = new Map([['2026-09-18/vocab-01.mp3', { previousSha256, sha256: sha('new synthesis bytes') }]]);
    expect(() => synchronizeAudioFileVersions(root, { regenerated })).toThrow('example-01.mp3: missing or invalid recorded file SHA-256');
    expect(read(root, '2026-09-18').items[0].wordSha256).toBe(previousSha256);
    expect(read(root, '2026-09-19').items[0].exampleSha256).toBeUndefined();
  });

  it('verifies review source records before a new target can annotate their current bytes', () => {
    const root = fixture();
    const source = { date: '2026-09-18', items: [{ word: 'vocab-01.mp3', wordSha256: sha('original word bytes') }] };
    expect(verifiedManifestAudioFileVersion(source, root, '2026-09-18', 'vocab-01.mp3')).toBe(sha('original word bytes'));
    writeFileSync(join(root, '2026-09-18', 'vocab-01.mp3'), 'different valid recording bytes');
    expect(() => verifiedManifestAudioFileVersion(source, root, '2026-09-18', 'vocab-01.mp3')).toThrow('SHA-256 mismatch');
    delete source.items[0].wordSha256;
    expect(() => verifiedManifestAudioFileVersion(source, root, '2026-09-18', 'vocab-01.mp3')).toThrow('explicit audio:versions:write migration');
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

  it('rejects an empty file before the explicit backfill writes any manifest', () => {
    const root = fixture();
    save(root, '2026-09-18', { date: '2026-09-18', items: [{ word: 'vocab-01.mp3' }] });
    save(root, '2026-09-19', { date: '2026-09-19', items: [{ audioDate: '2026-09-18', example: 'example-01.mp3' }] });
    writeFileSync(join(root, '2026-09-18', 'example-01.mp3'), '');
    expect(() => synchronizeAudioFileVersions(root)).toThrow('empty audio recording');
    expect(read(root, '2026-09-18').items[0].wordSha256).toBeUndefined();
  });
});
