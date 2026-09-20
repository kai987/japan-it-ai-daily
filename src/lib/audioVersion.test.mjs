import { describe, expect, it } from 'vitest';
import { versionedAudioKey } from './audioVersion.mjs';

describe('immutable MP3 object keys', () => {
  const sha = 'abcdef01'.repeat(8);
  it('uses the same key for browser URLs and staged objects, including single filenames', () => {
    expect(versionedAudioKey('japanese/2026-09-20/example-01.mp3', sha)).toBe(`japanese/2026-09-20/example-01--${sha}.mp3`);
    expect(versionedAudioKey('example-01.mp3', sha.toUpperCase())).toBe(`example-01--${sha}.mp3`);
    expect(versionedAudioKey('example-01.mp3', 'b'.repeat(64))).not.toBe(versionedAudioKey('example-01.mp3', sha));
  });
  it('rejects unsafe keys and invalid versions instead of staging outside the audio root', () => {
    for (const path of ['', '/audio.mp3', '../audio.mp3', 'a/../audio.mp3', 'a//audio.mp3', 'a\\audio.mp3', 'a/%2e%2e/audio.mp3', 'a.mp3?v=1', 'a.mp3#x', 'a.txt', 'a b.mp3', 'https://example.com/a.mp3']) {
      expect(() => versionedAudioKey(path, sha), path).toThrow();
    }
    for (const version of [null, undefined, '', 'a'.repeat(63), 'g'.repeat(64), '../escape', 'a'.repeat(65)]) {
      expect(() => versionedAudioKey('audio.mp3', version)).toThrow();
    }
  });
});
