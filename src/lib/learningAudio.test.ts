import { describe, it, expect } from 'vitest';
import { resolveLearningRecording as resolve } from './learningAudio';
import { learningRecordingFiles } from '../../scripts/verify-audio-integrity.mjs';
const item = { term: '耐性', reading: 'たいせい', exampleJa: '耐性を確認します。', word: 'vocab-07.mp3', example: 'example-07.mp3' };
const target = { kind: 'word', term: '耐性', reading: 'たいせい', text: 'たいせい' };
describe('content-addressed learning audio mapping', () => {
  it('keeps the existing filename when a word changes display position', () => {
    expect(resolve({ items: [item] }, target)).toBe('vocab-07.mp3');
  });
  it('does not reuse another headword with the same reading', () => {
    expect(resolve({ items: [item] }, { ...target, term: '態勢' })).toBeNull();
  });
  it('falls back on missing, stale, duplicate and explicit browser-only entries', () => {
    expect(resolve({}, target)).toBeNull();
    expect(resolve({ items: [item, item] }, target)).toBeNull();
    expect(resolve({ items: [{ ...item, playback: 'browser-tts', word: null, example: null }] }, target)).toBeNull();
    expect(resolve({ items: [item] }, { ...target, kind: 'example', text: '変更後の例文。' })).toBeNull();
  });
  it('rejects arbitrary and traversing filenames', () => {
    for (const word of ['../old.mp3', 'https://example.org/old.mp3', 'vocab-1.json']) {
      expect(resolve({ items: [{ ...item, word }] }, target)).toBeNull();
    }
  });
  it('requires an exact grammar example match', () => {
    expect(resolve({ grammar: [{ exampleJa: '確認したうえで提出する。', example: 'grammar-02.mp3' }] }, { kind: 'grammar-example', text: '確認したうえで提出する。' })).toBe('grammar-02.mp3');
  });
  it('validates rather than silently ignoring missing recordings', () => {
    const fallback = { ...item, playback: 'browser-tts', reason: 'historical-jlpt-repair', word: null, example: null };
    expect(learningRecordingFiles([fallback], 'test')).toEqual([]);
    expect(() => learningRecordingFiles([{ ...item, word: null }], 'test')).toThrow();
    expect(() => learningRecordingFiles([{ ...fallback, word: 'stale.mp3' }], 'test')).toThrow();
    expect(() => learningRecordingFiles([{ ...fallback, wordHash: 'stale' }], 'test')).toThrow();
  });
});
