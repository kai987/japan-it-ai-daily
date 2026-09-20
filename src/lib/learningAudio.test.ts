import { describe, it, expect } from 'vitest';
import { resolveLearningRecording as resolve, resolveLearningRecordingAsset as resolveAsset } from './learningAudio';
import { learningRecordingFiles } from '../../scripts/verify-audio-integrity.mjs';
const item = { term: '耐性', reading: 'たいせい', exampleJa: '耐性を確認します。', word: 'vocab-07.mp3', example: 'example-07.mp3' };
const target = { kind: 'word', term: '耐性', reading: 'たいせい', text: 'たいせい' };
describe('content-addressed learning audio mapping', () => {
  it('selects each real recording byte version, including cross-day review references', () => {
    const wordSha256 = 'a'.repeat(64);
    const exampleSha256 = 'b'.repeat(64);
    const manifest = { items: [{ ...item, audioDate: '2026-08-12', wordSha256, exampleSha256 }], grammar: [{ exampleJa: item.exampleJa, example: 'grammar-02.mp3', exampleSha256 }] };
    expect(resolveAsset(manifest, target)).toEqual({ file: item.word, audioDate: '2026-08-12', sha256: wordSha256 });
    expect(resolveAsset(manifest, { ...target, kind: 'example', text: item.exampleJa })).toEqual({ file: item.example, audioDate: '2026-08-12', sha256: exampleSha256 });
    expect(resolveAsset(manifest, { kind: 'grammar-example', text: item.exampleJa })).toEqual({ file: 'grammar-02.mp3', sha256: exampleSha256 });
  });
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
  it('resolves review vocabulary and review grammar recordings from the same manifest', () => {
    const manifest = {
      items: [{
        studyKind: 'review' as const,
        identity: '検証する',
        firstIntroducedDate: '2026-08-12',
        term: '検証する',
        reading: 'けんしょうする',
        exampleJa: '実データで検証します。',
        audioDate: '2026-08-12',
        word: 'vocab-07.mp3',
        example: 'example-07.mp3',
      }],
      grammar: [{
        studyKind: 'review' as const,
        identity: 'わけではない',
        firstIntroducedDate: '2026-08-12',
        pattern: '～わけではない',
        exampleJa: 'すべてのケースに当てはまるわけではない。',
        audioDate: '2026-08-12',
        example: 'grammar-example-02.mp3',
      }],
    };
    expect(resolve(manifest, { kind: 'word', term: '検証する', reading: 'けんしょうする', text: 'けんしょうする' })).toBe('vocab-07.mp3');
    expect(resolveAsset(manifest, { kind: 'word', term: '検証する', reading: 'けんしょうする', text: 'けんしょうする' })).toEqual({ file: 'vocab-07.mp3', audioDate: '2026-08-12' });
    expect(resolveAsset(manifest, { kind: 'example', term: '検証する', reading: 'けんしょうする', text: '実データで検証します。' })).toEqual({ file: 'example-07.mp3', audioDate: '2026-08-12' });
    expect(resolveAsset(manifest, { kind: 'grammar-example', text: 'すべてのケースに当てはまるわけではない。' })).toEqual({ file: 'grammar-example-02.mp3', audioDate: '2026-08-12' });
  });
  it('validates rather than silently ignoring missing recordings', () => {
    const fallback = { ...item, playback: 'browser-tts', reason: 'historical-jlpt-repair', word: null, example: null };
    expect(learningRecordingFiles([fallback], 'test')).toEqual([]);
    expect(() => learningRecordingFiles([{ ...item, word: null }], 'test')).toThrow();
    expect(() => learningRecordingFiles([{ ...fallback, word: 'stale.mp3' }], 'test')).toThrow();
    expect(() => learningRecordingFiles([{ ...fallback, wordHash: 'stale' }], 'test')).toThrow();
  });
});
