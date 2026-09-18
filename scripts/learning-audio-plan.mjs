import { buildStudyArchive } from './learning-review.mjs';

const pad = (value) => String(value).padStart(2, '0');

function sourceVocabularyRef(archive, item) {
  const sourceDate = item.firstIntroducedDate;
  const sourceDay = archive.lessons?.[sourceDate]?.ja;
  if (!sourceDay) throw new Error(`${item.identity}: source lesson ${sourceDate} not found`);
  const index = (sourceDay.vocabulary || []).findIndex((candidate) => candidate.identity === item.identity);
  if (index < 0) throw new Error(`${item.identity}: source vocabulary not found on ${sourceDate}`);
  return {
    audioDate: sourceDate,
    word: `vocab-${pad(index + 1)}.mp3`,
    example: `example-${pad(index + 1)}.mp3`,
  };
}

function sourceGrammarRef(archive, item) {
  const sourceDate = item.firstIntroducedDate;
  const sourceDay = archive.lessons?.[sourceDate]?.ja;
  if (!sourceDay) throw new Error(`${item.identity}: source lesson ${sourceDate} not found`);
  const index = (sourceDay.grammar || []).findIndex((candidate) => candidate.identity === item.identity);
  if (index < 0) throw new Error(`${item.identity}: source grammar not found on ${sourceDate}`);
  return {
    audioDate: sourceDate,
    example: `grammar-example-${pad(index + 1)}.mp3`,
  };
}

const compactVocabulary = (archive, item) => ({
  studyKind: 'review',
  identity: item.identity,
  firstIntroducedDate: item.firstIntroducedDate,
  term: item.term,
  reading: item.reading,
  exampleJa: item.exampleJa,
  ...sourceVocabularyRef(archive, item),
});

const compactGrammar = (archive, item) => ({
  studyKind: 'review',
  identity: item.identity,
  firstIntroducedDate: item.firstIntroducedDate,
  pattern: item.pattern,
  exampleJa: item.exampleJa,
  ...sourceGrammarRef(archive, item),
});

export function reviewAudioCardsForDate(root, date, archive = buildStudyArchive(root)) {
  const day = archive.lessons?.[date]?.ja;
  if (!day) throw new Error(`${date}: study archive entry not found`);
  return {
    vocabulary: (day.reviewVocabulary || []).map((item) => compactVocabulary(archive, item)),
    grammar: (day.reviewGrammar || []).map((item) => compactGrammar(archive, item)),
  };
}
