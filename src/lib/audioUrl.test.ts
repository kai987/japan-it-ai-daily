import { describe, expect, it } from 'vitest';
import { resolveAudioAssetUrl, resolveLocalAudioAssetUrl } from './audioUrl';

describe('audio asset URL resolver', () => {
  it('uses the GitHub Pages base path when no CDN is configured', () => {
    expect(resolveAudioAssetUrl(
      ['japanese', '2026-08-31', 'vocab-01.mp3'],
      { siteBaseUrl: '/japan-it-ai-daily/' },
    )).toBe('/japan-it-ai-daily/audio/japanese/2026-08-31/vocab-01.mp3');
  });

  it('normalizes a site base path without a trailing slash', () => {
    expect(resolveAudioAssetUrl(
      ['japanese', '2026-08-31', 'vocab-01.mp3'],
      { siteBaseUrl: '/japan-it-ai-daily' },
    )).toBe('/japan-it-ai-daily/audio/japanese/2026-08-31/vocab-01.mp3');
  });

  it('keeps manifests on the site origin even when media uses a CDN', () => {
    expect(resolveLocalAudioAssetUrl(
      ['japanese', '2026-08-31', 'manifest.json'],
      '/japan-it-ai-daily/',
    )).toBe('/japan-it-ai-daily/audio/japanese/2026-08-31/manifest.json');
  });

  it('uses an HTTPS CDN root when configured for MP3 media', () => {
    expect(resolveAudioAssetUrl(
      ['japanese', '2026-08-31', 'example-01.mp3'],
      { audioBaseUrl: 'https://audio.example.com/' },
    )).toBe('https://audio.example.com/japanese/2026-08-31/example-01.mp3');
  });

  it('preserves a CDN path prefix', () => {
    expect(resolveAudioAssetUrl(
      ['japanese', '2026-08-31', 'interview-answer-01.mp3'],
      { audioBaseUrl: 'https://cdn.example.com/japan-it-ai-audio' },
    )).toBe('https://cdn.example.com/japan-it-ai-audio/japanese/2026-08-31/interview-answer-01.mp3');
  });

  it('falls back to local assets for unsafe or unsupported protocols', () => {
    expect(resolveAudioAssetUrl(
      ['japanese', '2026-08-31', 'vocab-01.mp3'],
      { audioBaseUrl: 'javascript:alert(1)', siteBaseUrl: '/japan-it-ai-daily/' },
    )).toBe('/japan-it-ai-daily/audio/japanese/2026-08-31/vocab-01.mp3');

    expect(resolveAudioAssetUrl(
      ['japanese', '2026-08-31', 'vocab-01.mp3'],
      { audioBaseUrl: 'http://audio.example.com/', siteBaseUrl: '/japan-it-ai-daily/' },
    )).toBe('/japan-it-ai-daily/audio/japanese/2026-08-31/vocab-01.mp3');
  });

  it('encodes path segments so manifest values cannot escape the audio root', () => {
    expect(resolveAudioAssetUrl(
      ['japanese', '../outside', 'voice file.mp3'],
      { audioBaseUrl: 'https://audio.example.com/' },
    )).toBe('https://audio.example.com/japanese/..%2Foutside/voice%20file.mp3');
  });
});
