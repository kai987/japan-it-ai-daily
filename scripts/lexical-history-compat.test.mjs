import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { contentDates, contentDirs, readContent } from './content-files.mjs';
import { buildStudyArchive } from './learning-review.mjs';
import { reviewAudioCardsForDate } from './learning-audio-plan.mjs';
import { exportStudySnapshot } from './export-study-snapshot.mjs';
import { resolveLearningRecordingAsset } from '../src/lib/learningAudio.ts';

const root = process.cwd();
const archive = buildStudyArchive(root);
const policy = JSON.parse(readFileSync(join(root, 'docs/jlpt-history/historical-variants.json')));
const snapshot = exportStudySnapshot(archive, 'a'.repeat(40));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('merging lexical families preserves the complete published teaching inventory', () => {
  // Original identities, examples, source dates and review evidence from 80d78fe3.
  // Frequency and additive lexical metadata deliberately do not determine IDs.
  const rows = Object.entries(archive.lessons).filter(([date]) => date < policy.effectiveFrom)
    .flatMap(([date, day]) => ['zh', 'ja'].flatMap(locale =>
      ['vocabulary', 'reviewVocabulary', 'grammar', 'reviewGrammar'].map(field =>
        [date, locale, field, day[locale][field].map(card => [card.identity, card.term ?? card.pattern,
          card.reading ?? '', card.exampleJa, card.firstIntroducedDate, card.studyKind, card.reviewEvidence ?? null])])));
  expect(digest(rows)).toBe('e777125df2787eaf341b73e8f2e9b0b4757a779e30a9540d216b922cc30ef820');
});

test('canonical frequencies and earliest lexical dates retain both original forms and audio', () => {
  for (const group of policy.groups) {
    const cards = group.occurrences.map(occurrence => {
      const day = archive.lessons[occurrence.date].ja;
      const index = day.vocabulary.findIndex(card => card.term === occurrence.term);
      const card = day.vocabulary[index];
      const original = readContent(root, 'japanese-ja', occurrence.date).data.vocabulary[index];
      expect(card).toMatchObject({...original, identity:occurrence.legacyIdentity, studyKind:'new',
        firstIntroducedDate:occurrence.date, lexicalIdentity:group.lexicalIdentity,
        lexicalFirstIntroducedDate:group.firstIntroducedDate});
      expect(snapshot.firstVocabulary[card.identity]).toBe(occurrence.date);
      expect(snapshot.vocabularyFrequency[card.identity]).toEqual(card.reportFrequency);
      expect(snapshot.vocabularyFrequency[card.term]).toEqual(card.reportFrequency);
      const manifest = JSON.parse(readFileSync(join(root, 'public/audio/japanese', occurrence.date, 'manifest.json')));
      const expectedWord = `vocab-${String(index + 1).padStart(2, '0')}.mp3`;
      const expectedExample = `example-${String(index + 1).padStart(2, '0')}.mp3`;
      for (const [kind, text, file] of [['word', card.reading, expectedWord], ['example', card.exampleJa, expectedExample]]) {
        const asset = resolveLearningRecordingAsset(manifest, {kind, term:card.term, reading:card.reading, text});
        expect(asset?.file).toBe(file);
        expect(asset?.audioDate ?? occurrence.date).toBe(occurrence.date);
        const bytes = readFileSync(join(root, 'public/audio/japanese', occurrence.date, file));
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
      }
      return card;
    });
    expect(cards[0].reportFrequency).toEqual(cards[1].reportFrequency);
    expect(snapshot.vocabularyFrequency[group.lexicalIdentity]).toEqual(cards[0].reportFrequency);
    expect(snapshot.firstLexicalVocabulary[group.lexicalIdentity]).toBe(group.firstIntroducedDate);
    for (const occurrence of group.occurrences) expect(cards[0].reportFrequency.appearedDates).toContain(occurrence.date);
  }
});

function futureFixture(term = '独自試験語') {
  const directory = mkdtempSync(join(tmpdir(), 'lexical-family-fixture-'));
  for (const dir of contentDirs) {
    mkdirSync(join(directory, 'src/content', dir), {recursive:true});
    for (const date of contentDates(root).filter(date => date < policy.effectiveFrom))
      symlinkSync(join(root, 'src/content', dir, date + '.md'), join(directory, 'src/content', dir, date + '.md'));
  }
  for (const path of ['docs/jlpt-history/identity-rules.json','docs/jlpt-history/historical-variants.json','docs/grammar-history/identity-rules.json']) {
    mkdirSync(join(directory, path, '..'), {recursive:true});
    copyFileSync(join(root, path), join(directory, path));
  }
  const date = policy.effectiveFrom;
  const card = {term, reading:'どくじしけんご', level:'N1', partOfSpeech:'名詞', meaning:'検証用',
    meaningZh:'测试用', exampleJa:'独自の試験語を確認します。', exampleZh:'确认测试词。'};
  const prose = policy.groups.flatMap(group => group.occurrences.map(occurrence => occurrence.term + '。')).join('\n');
  for (const dir of contentDirs) {
    const data = dir.startsWith('japanese') ? {vocabulary:[card], grammar:[], mustRememberWords:[term]} : {top:[]};
    writeFileSync(join(directory, 'src/content', dir, date + '.md'), `---\n${JSON.stringify(data)}\n---\n${prose}\n`);
  }
  return directory;
}

test('future reviews select one original recording per lexical family', () => {
  const directory = futureFixture();
  try {
    const future = buildStudyArchive(directory);
    const cards = future.lessons[policy.effectiveFrom].ja.reviewVocabulary;
    const audio = reviewAudioCardsForDate(directory, policy.effectiveFrom, future).vocabulary;
    const all = [...future.lessons[policy.effectiveFrom].ja.vocabulary, ...cards];
    expect(new Set(all.map(card => card.lexicalIdentity)).size).toBe(all.length);
    for (const group of policy.groups) {
      const matches = cards.filter(card => card.lexicalIdentity === group.lexicalIdentity);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatchObject({term:group.occurrences[0].term, identity:group.occurrences[0].legacyIdentity,
        firstIntroducedDate:group.firstIntroducedDate, lexicalFirstIntroducedDate:group.firstIntroducedDate});
      expect(matches[0].reviewEvidence.excerpt).toContain(matches[0].reviewEvidence.form);
      expect(audio.find(card => card.identity === matches[0].identity)?.audioDate).toBe(group.firstIntroducedDate);
    }
  } finally { rmSync(directory, {recursive:true, force:true}); }
});

test('the archive itself rejects a future third form rather than bypassing the canonical gate', () => {
  const directory = futureFixture('誤る');
  try { expect(() => buildStudyArchive(directory)).toThrow(/already introduced on 2026-09-02/); }
  finally { rmSync(directory, {recursive:true, force:true}); }
});

test('snapshot export remains usable with a legacy archive lacking lexical metadata', () => {
  const old = structuredClone(archive);
  for (const day of Object.values(old.lessons)) for (const card of day.zh.vocabulary) {
    delete card.lexicalIdentity; delete card.lexicalFirstIntroducedDate;
  }
  const result = exportStudySnapshot(old, 'a'.repeat(40));
  expect(Object.hasOwn(result.firstLexicalVocabulary, 'undefined')).toBe(false);
  expect(Object.hasOwn(result.vocabularyFrequency, 'undefined')).toBe(false);
});
