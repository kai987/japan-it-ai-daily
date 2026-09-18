import { expect, test } from 'vitest';
import { buildStudyArchive } from './learning-review.mjs';
import { reviewAudioCardsForDate } from './learning-audio-plan.mjs';

const archive = buildStudyArchive();

test('review audio plan mirrors derived review cards without future backfill', () => {
  const dates = Object.keys(archive.lessons).sort();
  let historicalGrammarDays = 0;

  for (const date of dates) {
    const plan = reviewAudioCardsForDate(process.cwd(), date, archive);
    const expected = archive.lessons[date].ja;

    expect(plan.vocabulary.map((item) => item.identity)).toEqual(expected.reviewVocabulary.map((item) => item.identity));
    expect(plan.grammar.map((item) => item.identity)).toEqual(expected.reviewGrammar.map((item) => item.identity));

    for (const item of plan.vocabulary) {
      expect(item.studyKind).toBe('review');
      expect(item.firstIntroducedDate < date).toBe(true);
      expect(item.term).toBeTruthy();
      expect(item.reading).toBeTruthy();
      expect(item.exampleJa).toBeTruthy();
      expect(item.audioDate).toBe(item.firstIntroducedDate);
      expect(item.word).toMatch(/^vocab-\d{2}\.mp3$/);
      expect(item.example).toMatch(/^example-\d{2}\.mp3$/);
      expect(item.word.startsWith('review-')).toBe(false);
      expect(item.example.startsWith('review-')).toBe(false);
    }
    for (const item of plan.grammar) {
      expect(item.studyKind).toBe('review');
      expect(item.firstIntroducedDate < date).toBe(true);
      expect(item.pattern).toBeTruthy();
      expect(item.exampleJa).toBeTruthy();
      expect(item.audioDate).toBe(item.firstIntroducedDate);
      expect(item.example).toMatch(/^grammar-example-\d{2}\.mp3$/);
      expect(item.example.startsWith('review-')).toBe(false);
    }

    if (date < archive.lastDate && plan.grammar.length) historicalGrammarDays += 1;
  }

  expect(historicalGrammarDays).toBeGreaterThan(0);
});

test('latest day exposes review cards to the audio generator when present', () => {
  const date = archive.lastDate;
  const plan = reviewAudioCardsForDate(process.cwd(), date, archive);
  expect(plan.vocabulary.length + plan.grammar.length).toBeGreaterThan(0);
});
