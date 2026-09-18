import { buildStudyArchive } from './learning-review.mjs';

const compactVocabulary = (item) => ({
  studyKind: 'review',
  identity: item.identity,
  firstIntroducedDate: item.firstIntroducedDate,
  term: item.term,
  reading: item.reading,
  exampleJa: item.exampleJa,
});

const compactGrammar = (item) => ({
  studyKind: 'review',
  identity: item.identity,
  firstIntroducedDate: item.firstIntroducedDate,
  pattern: item.pattern,
  exampleJa: item.exampleJa,
});

export function reviewAudioCardsForDate(root, date, archive = buildStudyArchive(root)) {
  const day = archive.lessons?.[date]?.ja;
  if (!day) throw new Error(`${date}: study archive entry not found`);
  return {
    vocabulary: (day.reviewVocabulary || []).map(compactVocabulary),
    grammar: (day.reviewGrammar || []).map(compactGrammar),
  };
}
