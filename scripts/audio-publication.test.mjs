import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test, vi } from 'vitest';
import { immutableAudioAssets, repairAudioBatch, stageAudioAssets, stageChangedAudio } from './audio-publication.mjs';
import { versionedAudioKey } from '../src/lib/audioVersion.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const key = 'japanese/2026-09-20/example-01.mp3';

function fixture(check) {
  const root = mkdtempSync(join(tmpdir(), 'audio-publication-'));
  const directory = join(root, 'public/audio/japanese/2026-09-20');
  mkdirSync(directory, { recursive: true });
  const bytes = Buffer.from('actual MP3 byte fixture');
  writeFileSync(join(root, 'public/audio', key), bytes);
  try { check({ root, directory, bytes, expected: { sha256: hash(bytes), size: bytes.length, sourcePath: key } }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test('a changed MP3 stages legacy and hash keys from identical bytes without changing tracked filenames', () => fixture(({ root, directory, bytes }) => {
  writeFileSync(join(directory, 'manifest.json'), '{}');
  writeFileSync(join(directory, 'example-02.mp3'), 'unrelated');
  const staging = join(root, 'staging');
  const originalFiles = readdirSync(directory);
  expect(stageChangedAudio([`public/audio/${key}`, 'public/audio/japanese/2026-09-20/manifest.json'], staging, root)).toBe(3);
  expect(readFileSync(join(staging, key))).toEqual(bytes);
  expect(readFileSync(join(staging, versionedAudioKey(key, hash(bytes))))).toEqual(bytes);
  expect(existsSync(join(staging, 'japanese/2026-09-20/example-02.mp3'))).toBe(false);
  expect(readdirSync(directory)).toEqual(originalFiles);
}));

test('repair batches only confirmed immutable objects into a single concurrent AWS transfer', () => fixture(({ root, bytes, expected }) => {
  const assets = immutableAudioAssets(new Map([[key, expected]]));
  let staging;
  const run = vi.fn((program, args) => {
    expect(program).toBe('aws');
    expect(args.slice(0, 2)).toEqual(['s3', 'cp']);
    expect(args).toContain('--recursive');
    staging = args[2];
    expect(readFileSync(join(staging, versionedAudioKey(key, expected.sha256)))).toEqual(bytes);
    expect(existsSync(join(staging, key))).toBe(false);
  });
  repairAudioBatch(assets, { root, bucket: 'audio-test', endpoint: `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`, run });
  expect(run).toHaveBeenCalledTimes(1);
  expect(existsSync(staging)).toBe(false);
}));

test('staging refuses a source changed after hashing and cannot publish it under the expected hash', () => fixture(({ root, expected }) => {
  const assets = immutableAudioAssets(new Map([[key, expected]]));
  writeFileSync(join(root, 'public/audio', key), 'new different bytes');
  const run = vi.fn();
  expect(() => repairAudioBatch(assets, { root, bucket: 'audio-test', endpoint: `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`, run })).toThrow('changed after verification');
  expect(run).not.toHaveBeenCalled();
}));

test('staging refuses key/source substitution', () => fixture(({ root, expected }) => {
  const unrelated = 'japanese/2026-09-20/example-02.mp3';
  expect(() => stageAudioAssets(new Map([[unrelated, expected]]), join(root, 'stage'), root)).toThrow('Invalid staged audio mapping');
  expect(() => immutableAudioAssets(new Map([['../escape.mp3', { ...expected, sourcePath: '../escape.mp3' }]]))).toThrow('Invalid local audio source');
}));
