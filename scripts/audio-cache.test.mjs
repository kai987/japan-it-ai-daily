import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAudioTaskHash, isReusableAudio } from './audio-cache.mjs';

const roots = [];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const cachedFile = () => {
  const root = mkdtempSync(join(tmpdir(), 'audio-cache-'));
  roots.push(root);
  const filePath = join(root, 'vocab-01.mp3');
  writeFileSync(filePath, 'trusted recording bytes');
  return { filePath, expectedHash: 'matching-task', previousHash: 'matching-task', previousSha256: sha('trusted recording bytes') };
};
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

const basePayload = {
  scope: 'japanese-example',
  text: 'AI Agentを段階的に導入します。',
  voice: {
    styleId: 497929760,
    speakerUuid: '396a746d-742f-4e43-b722-1182a7fab9af',
    modelVersion: '1.0.0',
  },
  synthesis: {
    speedScale: 1,
    intonationScale: 1,
    volumeScale: 1,
    prePhonemeLength: 0.1,
    postPhonemeLength: 0.12,
    outputSamplingRate: 24000,
    outputStereo: false,
  },
  format: {
    container: 'mp3',
    sampleRate: 24000,
    bitrate: '96k',
    channels: 1,
  },
};

describe('audio cache hashes', () => {
  it('is deterministic even when object key order differs', () => {
    const first = createAudioTaskHash(basePayload);
    const second = createAudioTaskHash({
      format: basePayload.format,
      synthesis: basePayload.synthesis,
      voice: basePayload.voice,
      text: basePayload.text,
      scope: basePayload.scope,
    });
    expect(second).toBe(first);
  });

  it('changes when source text changes', () => {
    expect(createAudioTaskHash({ ...basePayload, text: 'AI Agentを導入します。' }))
      .not.toBe(createAudioTaskHash(basePayload));
  });

  it('changes when voice or synthesis settings change', () => {
    expect(createAudioTaskHash({
      ...basePayload,
      synthesis: { ...basePayload.synthesis, speedScale: 1.08 },
    })).not.toBe(createAudioTaskHash(basePayload));

    expect(createAudioTaskHash({
      ...basePayload,
      voice: { ...basePayload.voice, modelVersion: '1.1.0' },
    })).not.toBe(createAudioTaskHash(basePayload));
  });
});

describe('audio cache reuse', () => {
  it('reuses only a matching synthesis task and nonempty recorded bytes', () => {
    const cached = cachedFile();
    expect(isReusableAudio(cached)).toBe(true);
    expect(isReusableAudio({ ...cached, expectedHash: 'changed-task' })).toBe(false);
    rmSync(cached.filePath);
    expect(isReusableAudio(cached)).toBe(false);
  });

  it('rejects replaced bytes even when the synthesis task matches or changes', () => {
    const cached = cachedFile();
    writeFileSync(cached.filePath, 'different nonempty recording');
    expect(() => isReusableAudio(cached)).toThrow(`${cached.filePath}: recorded file SHA-256 mismatch`);
    expect(() => isReusableAudio({ ...cached, expectedHash: 'changed-task' })).toThrow('SHA-256 mismatch');
    expect(isReusableAudio({ ...cached, force: true })).toBe(false);
  });

  it('rejects an empty recording and never treats its empty digest as a valid cache', () => {
    const cached = cachedFile();
    writeFileSync(cached.filePath, '');
    expect(() => isReusableAudio({ ...cached, previousSha256: sha('') })).toThrow(`${cached.filePath}: empty audio recording`);
  });

  it('requires explicit byte-version backfill before modern or legacy cache migration', () => {
    const cached = cachedFile();
    expect(() => isReusableAudio({ ...cached, previousSha256: undefined })).toThrow('explicit audio:versions:write migration');
    expect(() => isReusableAudio({ ...cached, previousHash: undefined, previousSha256: undefined, legacyMatches: true }))
      .toThrow('explicit audio:versions:write migration');
    expect(isReusableAudio({ ...cached, previousHash: undefined, legacyMatches: true })).toBe(true);
    expect(isReusableAudio({ ...cached, previousHash: undefined, legacyMatches: false })).toBe(false);
  });
});
