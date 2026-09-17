import { describe, expect, it } from 'vitest';
import { matchingLessonClip } from './lessonAudioManifest';
const manifest = {items:[{term:'橋',reading:'はし',word:'vocab-02.mp3',exampleJa:'橋を渡ります。',example:'example-02.mp3'}],grammar:[{exampleJa:'確認した上で実行します。',example:'grammar-example-01.mp3'}]};
describe('edited vocabulary audio identity', () => {
  it('finds a word by identity, not by its new array index', () => expect(matchingLessonClip(manifest,'word','はし','橋')).toBe('vocab-02.mp3'));
  it('rejects a different word with the same reading', () => expect(matchingLessonClip(manifest,'word','はし','箸')).toBeUndefined());
  it('rejects missing word identity', () => expect(matchingLessonClip(manifest,'word','はし')).toBeUndefined());
  it('rejects a replaced sentence', () => expect(matchingLessonClip(manifest,'example','新しい例文です。')).toBeUndefined());
  it('retains unchanged examples and grammar', () => {
    expect(matchingLessonClip(manifest,'example','橋を渡ります。')).toBe('example-02.mp3');
    expect(matchingLessonClip(manifest,'grammar-example','確認した上で実行します。')).toBe('grammar-example-01.mp3');
  });
  it('fails safely for missing metadata', () => expect(matchingLessonClip({},'word','はし','橋')).toBeUndefined());
  it('rejects unsafe filenames', () => expect(matchingLessonClip({items:[{...manifest.items[0],word:'../old.mp3'}]},'word','はし','橋')).toBeUndefined());
});
