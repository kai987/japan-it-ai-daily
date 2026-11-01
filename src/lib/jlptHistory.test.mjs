import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeLexicalKey, checkDays, checkHistory } from '../../scripts/check-jlpt-history.mjs';
import { readContent } from '../../scripts/content-files.mjs';
import { historicalVocabularyRules, loadLexicalIdentityPolicy, vocabularyCardHash } from '../../scripts/lexical-identity-policy.mjs';
const rules = JSON.parse(readFileSync(new URL('../../docs/jlpt-history/identity-rules.json', import.meta.url), 'utf8'));
const key = makeLexicalKey(rules);
const policy = loadLexicalIdentityPolicy(process.cwd(), rules);
const reviewedPairs = [
  ['一律に', '一律'], ['まかなう', '賄う'], ['据え置く', '据え置き'],
  ['偏る', '偏り'], ['抜け', '抜ける'], ['一気通貫で', '一気通貫'], ['誤り', '誤って'],
];
const day = (date, terms, must = terms) => ({ date, vocabulary: terms.map((term) => ({ term })), mustRememberWords: must });
const reviewedDays = () => {
  const originals = policy.groups.flatMap((group) => group.occurrences);
  return [...new Set(originals.map((item) => item.date))].sort().map((date) => {
    const terms = new Set(originals.filter((item) => item.date === date).map((item) => item.term));
    const vocabulary = readContent(process.cwd(), 'japanese', date).data.vocabulary.filter((item) => terms.has(item.term));
    const japaneseVocabulary = readContent(process.cwd(), 'japanese-ja', date).data.vocabulary.filter((item) => terms.has(item.term));
    return { date, vocabulary, japaneseVocabulary, mustRememberWords: vocabulary.map((item) => item.term) };
  });
};
const findOriginal = (days, occurrence) => days.find((item) => item.date === occurrence.date);
describe('full-history JLPT vocabulary gate', () => {
  it('normalizes the reviewed lexical variants without comparing only yesterday', () => {
    for (const pair of [['把握', '把握する'], ['取り組む', '取組む'], ['取り組む', '取り組んだ'], ['妥当', '妥当な'], ['妥当性', '妥当'], ['意図せず', '意図'], ['既に', 'すでに'], ['ひも付ける', '紐づける'], ['手軽に', '手軽'], ['有機的な', '有機的']]) {
      expect(key(pair[0])).toBe(key(pair[1]));
    }
    expect(() => checkDays([day('01', ['把握']), day('02', ['誤り']), day('03', ['把握する'])], key)).toThrow(/already introduced on 01/);
  });
  it('does not merge distinct homophones or arbitrary compound nouns', () => {
    for (const [a,b] of [['耐性','態勢'], ['審議','真偽'], ['則る','乗っ取る'], ['必ず','必ずしも'], ['責任','責任主体'], ['抜ける','すり抜ける'], ['抜け','抜け漏れ'], ['偏る','偏見'], ['一律','一様'], ['誤る','謝る']]) expect(key(a)).not.toBe(key(b));
  });
  it('rejects same-day duplicates, invalid C4 subsets and empty history', () => {
    expect(() => checkDays([day('01', ['把握','把握する'])], key)).toThrow(/within day/);
    expect(() => checkDays([day('01', ['把握'], ['別の語'])], key)).toThrow(/C-4/);
    expect(() => checkDays([], key)).toThrow(/No history/);
  });
  it('checks all actual published dates and all four content representations', () => {
    const result = checkHistory(process.cwd());
    expect(result.dates).toBeGreaterThanOrEqual(37);
    expect(result.vocabulary).toBeGreaterThanOrEqual(740);
    expect(result.originalVocabulary - result.vocabulary).toBe(7);
    expect(result.historicalVariants).toBe(7);
    expect(result.duplicates).toBe(0);
  });
});

describe('closed historical lexical-variant migration', () => {
  it('normalizes all seven reviewed groups and the dictionary identity 誤る', () => {
    for (const [first, later] of reviewedPairs) expect(key(first)).toBe(key(later));
    expect(key('誤り')).toBe('誤る');
    expect(key('誤って')).toBe('誤る');
    expect(key(' 一律に\u200b ')).toBe('一律');
  });

  it('reconstructs old identities by removing only the eight reviewed aliases', () => {
    const before = structuredClone(rules), historical = historicalVocabularyRules(rules, policy);
    const oldKey = makeLexicalKey(historical);
    expect(policy.effectiveFrom).toBe('2026-11-02');
    expect(Object.keys(policy.aliasAdditions)).toHaveLength(8);
    for (const [first, later] of reviewedPairs) expect(oldKey(first)).not.toBe(oldKey(later));
    for (const group of policy.groups) for (const occurrence of group.occurrences) expect(oldKey(occurrence.term)).toBe(occurrence.legacyIdentity);
    expect(oldKey('取り組んだ')).toBe('取り組む');
    expect(oldKey('把握する')).toBe('把握');
    expect(oldKey('妥当性')).toBe('妥当');
    expect(rules).toEqual(before);
    expect(Object.keys(rules.aliases).length - Object.keys(historical.aliases).length).toBe(8);
    const altered = structuredClone(rules);
    altered.aliases['一律に'] = '一様';
    expect(() => historicalVocabularyRules(altered, policy)).toThrow(/no longer matches/);
  });

  it('accepts exactly fourteen pinned bilingual originals and seven later variants', () => {
    const days = reviewedDays(), before = structuredClone(days);
    expect(policy.groups).toHaveLength(7);
    expect(policy.groups.flatMap((group) => group.occurrences)).toHaveLength(14);
    expect(checkDays(days.toReversed(), key, policy)).toEqual({ dates: days.length, vocabulary: 7, originalVocabulary: 14, historicalVariants: 7, duplicates: 0 });
    expect(days).toEqual(before);
    expect(() => checkDays(days, key)).toThrow(/already introduced/);
  });

  it('rejects changed fields in either language of every pinned original', () => {
    for (const group of policy.groups) for (const occurrence of group.occurrences) for (const field of ['vocabulary', 'japaneseVocabulary']) {
      const days = reviewedDays(), original = findOriginal(days, occurrence);
      const card = original[field].find((item) => item.term === occurrence.term);
      card.exampleJa += '変更';
      expect(() => checkDays(days, key, policy)).toThrow(/changed historical vocabulary payload/);
    }
  });

  it('rejects missing originals, bilingual payloads and incorrect earliest dates', () => {
    const group = policy.groups[0], first = group.occurrences[0], later = group.occurrences[1];
    expect(() => checkDays(reviewedDays().filter((item) => item.date !== first.date), key, policy)).toThrow(/wrong first introduction/);
    expect(() => checkDays(reviewedDays().filter((item) => item.date !== later.date), key, policy)).toThrow(/Unused or stale/);
    const days = reviewedDays();
    delete findOriginal(days, first).japaneseVocabulary;
    expect(() => checkDays(days, key, policy)).toThrow(/missing bilingual/);
    const earlier = structuredClone(findOriginal(reviewedDays(), first));
    earlier.date = '2026-08-12';
    expect(() => checkDays([earlier, ...reviewedDays()], key, policy)).toThrow(/wrong first introduction/);
    const wrongFirst = structuredClone(policy);
    wrongFirst.groups[0].firstIntroducedDate = '2026-08-12';
    expect(() => checkDays(reviewedDays(), key, wrongFirst)).toThrow(/wrong first introduction/);
  });

  it('keeps all seven identities closed to third and future NEW occurrences', () => {
    for (const group of policy.groups) {
      const first = group.occurrences[0];
      for (const date of ['2026-10-29', '2026-11-02', '2026-12-01']) {
        const duplicate = structuredClone(findOriginal(reviewedDays(), first));
        duplicate.date = date;
        expect(() => checkDays([...reviewedDays(), duplicate], key, policy)).toThrow(/already introduced/);
      }
    }
    const days = reviewedDays(), first = policy.groups[0].occurrences[0];
    const original = findOriginal(days, first);
    original.vocabulary.push({ term: policy.groups[0].lexicalIdentity });
    original.japaneseVocabulary.push({ term: policy.groups[0].lexicalIdentity });
    expect(() => checkDays(days, key, policy)).toThrow(/within day/);
    expect(() => checkDays([...reviewedDays(), reviewedDays()[0]], key, policy)).toThrow(/Duplicate vocabulary history date/);
  });

  it('rejects expanded or stale policies rather than making a historical cutoff bypass', () => {
    const expanded = structuredClone(policy);
    expanded.groups[0].occurrences.push({ ...expanded.groups[0].occurrences[1], date: '2026-11-02' });
    expect(() => checkDays(reviewedDays(), key, expanded)).toThrow(/exactly two originals/);
    const future = structuredClone(policy);
    future.groups[0].occurrences[1].date = '2026-11-02';
    expect(() => checkDays(reviewedDays(), key, future)).toThrow(/invalid occurrence date/);
    const stale = structuredClone(policy);
    stale.groups[0].occurrences[1].date = '2026-10-31';
    expect(() => checkDays(reviewedDays(), key, stale)).toThrow(/already introduced/);
  });

  it('hashes whole card values independently of object field ordering', () => {
    expect(vocabularyCardHash({ term: '誤り', collocations: ['一', '二'], nested: { reading: 'あやまり', level: 'N2' } }))
      .toBe(vocabularyCardHash({ nested: { level: 'N2', reading: 'あやまり' }, collocations: ['一', '二'], term: '誤り' }));
    expect(vocabularyCardHash({ term: '誤り', collocations: ['一', '二'] })).not.toBe(vocabularyCardHash({ term: '誤り', collocations: ['二', '一'] }));
  });
});
