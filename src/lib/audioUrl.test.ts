import { describe, expect, it } from 'vitest';
import { resolveAudioAssetUrl, resolveLocalAudioAssetUrl, versionAudioAssetUrl } from './audioUrl';

describe('audio asset URL resolver', () => {
  it('uses immutable CDN object paths and local byte query versions while keeping old manifests compatible', () => {
    const sha = 'a'.repeat(64);
    for (const url of ['/audio/japanese/2026-09-18/example-01.mp3', 'https://audio.example.com/japanese/2026-09-18/example-01.mp3']) {
      expect(versionAudioAssetUrl(url, sha)).toBe(url.startsWith('https:') ? url.replace('.mp3', `--${sha}.mp3`) : `${url}?v=${sha}`);
      expect(versionAudioAssetUrl(url, 'b'.repeat(64))).not.toBe(versionAudioAssetUrl(url, sha));
      for (const invalid of [undefined, '', '../bad', 'task-hash', null]) expect(versionAudioAssetUrl(url, invalid)).toBe(url);
    }
  });
  it('never leaves the mutable object key in a versioned external playback URL', () => {
    const url = resolveAudioAssetUrl(['japanese', '2026-09-20', 'example-01.mp3'], { audioBaseUrl: 'https://audio.example.com/media/' });
    const versioned = new URL(versionAudioAssetUrl(url, 'b'.repeat(64)));
    expect(versioned.pathname).toBe(`/media/japanese/2026-09-20/example-01--${'b'.repeat(64)}.mp3`);
    expect(versioned.search).toBe('');
    expect(versioned.href).not.toContain('/example-01.mp3');
  });
  it('preserves valid custom CDN directory prefixes while validating the MP3 basename', () => {
    const url = resolveAudioAssetUrl(['japanese', '2026-09-20', 'example-01.mp3'], { audioBaseUrl: 'https://audio.example.com/v1.0/my%20audio/' });
    expect(versionAudioAssetUrl(url, 'c'.repeat(64))).toBe(`https://audio.example.com/v1.0/my%20audio/japanese/2026-09-20/example-01--${'c'.repeat(64)}.mp3`);
    expect(() => versionAudioAssetUrl('https://audio.example.com/prefix/..%2Foutside.mp3', 'c'.repeat(64))).toThrow();
  });
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
