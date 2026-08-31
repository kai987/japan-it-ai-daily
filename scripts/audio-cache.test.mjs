import { describe, expect, it } from 'vitest';
import { createAudioTaskHash } from './audio-cache.mjs';

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
