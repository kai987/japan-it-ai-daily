import { describe, expect, it } from 'vitest';
import { createIdentity, auditVocabularyHistory } from './identity.mjs';
import { validateVocabularyHistory, vocabularyHeadings, selectedVocabulary } from './validate.mjs';
import { readContent, contentDirs } from '../content-files.mjs';
import { validateContentDay } from '../validate-content-integrity.mjs';
const word = (term,partOfSpeech='名詞') => ({term,partOfSpeech});
describe('JLPT all-history guard', () => {
  it('normalizes lexical variants without merging homophones', () => {
    const id = createIdentity({aliases:{'取り組む':'取組む'},adjectiveStems:['妥当'],suruStems:['把握']});
    expect(id('把握する')).toBe(id('把握'));expect(id('妥当な')).toBe(id('妥当に'));
    expect(id(' 取り組む ')).toBe(id('取組む'));expect(id('橋')).not.toBe(id('箸'));
  });
  it('checks every earlier date, not just yesterday', () => {
    const audit = auditVocabularyHistory([{date:'2026-09-17',vocabulary:[word('根拠')]},{date:'2026-08-12',vocabulary:[word('根拠')]}]);
    expect(audit.duplicates[0].firstDate).toBe('2026-08-12');expect(audit.unique).toBe(1);
  });
  it('rejects duplicate date records and same-day duplicates', () => {
    expect(() => auditVocabularyHistory([{date:'2026-09-17',vocabulary:[]},{date:'2026-09-17',vocabulary:[]}])).toThrow();
    expect(auditVocabularyHistory([{date:'2026-09-17',vocabulary:[word('根拠'),word('根拠')]}]).duplicates).toHaveLength(1);
  });
  it('requires real C-1/C-2 boundaries', () => expect(() => vocabularyHeadings('No cards')).toThrow());
  it('reads legacy and repaired C-4 without consuming grammar', () => {
    expect(selectedVocabulary('## C-4. 今日の必修\n\n**10語：** 把握する・考慮する\n\n**5文法：** ～なくしては')).toEqual(['把握する','考慮する']);
    expect(selectedVocabulary('## C-4. 今日必背\n\n**2重点词：** 根拠・負荷\n\n### 5个语法\n')).toEqual(['根拠','負荷']);
  });
  it('validates all published bilingual history', () => expect(validateVocabularyHistory(process.cwd()).errors).toEqual([]));
  it('allows an explained shortfall but not silent data loss or stale selections', () => {
    const date='2026-08-19',docs=Object.fromEntries(contentDirs.map((dir)=>[dir,readContent(process.cwd(),dir,date).data]));
    expect(validateContentDay(date,docs)).toEqual([]);
    delete docs.japanese.vocabularyShortfallReason;
    expect(validateContentDay(date,docs).some((e)=>e.includes('shortfall'))).toBe(true);
    docs.japanese.mustRememberWords=['不存在'];
    expect(validateContentDay(date,docs).some((e)=>e.includes('unknown item'))).toBe(true);
  });
});
