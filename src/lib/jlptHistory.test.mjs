import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeLexicalKey, checkDays, checkHistory } from '../../scripts/check-jlpt-history.mjs';
const rules = JSON.parse(readFileSync(new URL('../../docs/jlpt-history/identity-rules.json', import.meta.url), 'utf8'));
const key = makeLexicalKey(rules);
const day = (date, terms, must = terms) => ({ date, vocabulary: terms.map((term) => ({ term })), mustRememberWords: must });
describe('full-history JLPT vocabulary gate', () => {
  it('normalizes the reviewed lexical variants without comparing only yesterday', () => {
    for (const pair of [['把握', '把握する'], ['取り組む', '取組む'], ['取り組む', '取り組んだ'], ['妥当', '妥当な'], ['妥当性', '妥当'], ['意図せず', '意図'], ['既に', 'すでに'], ['ひも付ける', '紐づける'], ['手軽に', '手軽'], ['有機的な', '有機的']]) {
      expect(key(pair[0])).toBe(key(pair[1]));
    }
    expect(() => checkDays([day('01', ['把握']), day('02', ['誤り']), day('03', ['把握する'])], key)).toThrow(/already introduced on 01/);
  });
  it('does not merge distinct homophones or arbitrary compound nouns', () => {
    for (const [a,b] of [['耐性','態勢'], ['審議','真偽'], ['則る','乗っ取る'], ['必ず','必ずしも'], ['責任','責任主体']]) expect(key(a)).not.toBe(key(b));
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
    expect(result.duplicates).toBe(0);
  });
});
