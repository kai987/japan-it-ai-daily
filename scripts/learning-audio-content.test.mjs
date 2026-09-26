import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { learningAudioCards } from './learning-audio-content.mjs';

const learningSource = (date) => readFileSync(new URL(`../src/content/japanese/${date}.md`, import.meta.url), 'utf8');

describe('learning audio source', () => {
  it('reads all cards from the JSON frontmatter published on September 23', () => {
    const cards = learningAudioCards(learningSource('2026-09-23'), '2026-09-23');
    expect(cards.vocabulary).toHaveLength(20);
    expect(cards.grammar).toHaveLength(3);
    expect(cards.vocabulary[0]).toEqual({
      term: '悪意',
      reading: 'あくい',
      exampleJa: '悪意のあるExtensionを前提にPermission Boundaryを点検します。',
    });
  });

  it('also reads the later multiline YAML frontmatter', () => {
    const cards = learningAudioCards(learningSource('2026-09-26'), '2026-09-26');
    expect(cards.vocabulary).toHaveLength(15);
    expect(cards.grammar).toHaveLength(2);
  });

  it('rejects incomplete cards instead of silently omitting recordings', () => {
    expect(() => learningAudioCards('---\nvocabulary: [{term: 欠落, reading: けつらく}]\ngrammar: []\n---\n', 'test'))
      .toThrow('test: incomplete vocabulary card 1');
  });
});
