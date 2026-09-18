import {expect,test} from 'vitest';
import {buildStudyArchive,frequencyFor,issueNumbers,frequencyText} from './learning-review.mjs';
import {exportStudySnapshot} from './export-study-snapshot.mjs';
const archive=buildStudyArchive();
test('frequency counts distinct dates, not tokens or language mirrors',()=>{
 expect(frequencyFor(['2026-09-01','2026-09-01','2026-09-02'],3)).toEqual({appearedDays:2,totalDays:3,percent:66.7,appearedDates:['2026-09-01','2026-09-02']});
 expect(()=>frequencyFor(['a'],0)).toThrow(); expect(()=>frequencyFor(['a','b'],1)).toThrow();
});
test('issue numbers count published dates even when calendar dates have gaps',()=>{
 expect(issueNumbers(['2026-09-03','2026-09-01','2026-09-01'])).toEqual({'2026-09-01':1,'2026-09-03':2});
 expect(archive.lessons['2026-09-18'].issueNumber).toBe(38);
});
test('September 18 fills 20 words and 7 grammar without inventing new cards',()=>{
 const day=archive.lessons['2026-09-18'].zh;
 expect(day.vocabulary).toHaveLength(17); expect(day.reviewVocabulary).toHaveLength(3);
 expect(day.grammar).toHaveLength(0); expect(day.reviewGrammar).toHaveLength(7);
});
test('review identity was introduced earlier and really occurs on its report date',()=>{
 for(const [date,day] of Object.entries(archive.lessons)) for(const locale of ['zh','ja']) for(const kind of ['Vocabulary','Grammar']){
  const newItems=day[locale][kind.toLowerCase()], reviews=day[locale]['review'+kind];
  const ids=[...newItems,...reviews].map(x=>x.identity);expect(new Set(ids).size).toBe(ids.length);
  for(const item of reviews){expect(item.studyKind).toBe('review');expect(item.firstIntroducedDate<date).toBe(true);expect(item.reportFrequency.appearedDates).toContain(date);expect(item.reviewEvidence.excerpt).toContain(item.reviewEvidence.form);}
 }
});
test('Chinese/Japanese mirrors share counts, identities, proof and statistics',()=>{
 for(const day of Object.values(archive.lessons)) for(const field of ['vocabulary','grammar','reviewVocabulary','reviewGrammar'])
 expect(day.zh[field].map(x=>[x.identity,x.firstIntroducedDate,x.reportFrequency,x.reviewEvidence])).toEqual(day.ja[field].map(x=>[x.identity,x.firstIntroducedDate,x.reportFrequency,x.reviewEvidence]));
});
test('frequency numerator denominator and rounded percentage are inspectable for every card',()=>{
 for(const day of Object.values(archive.lessons)) for(const field of ['vocabulary','grammar','reviewVocabulary','reviewGrammar']) for(const item of day.zh[field]){
  const f=item.reportFrequency;expect(f.appearedDays).toBe(new Set(f.appearedDates).size);expect(f.totalDays).toBe(archive.totalDays);expect(f.percent).toBe(Number((f.appearedDays/f.totalDays*100).toFixed(1)));expect(frequencyText(f)).toContain('%');
 }
});
test('introducing review does not reinstate duplicated NEW entries in history',()=>{
 for(const kind of ['vocabulary','grammar']){const ids=Object.values(archive.lessons).flatMap(day=>day.zh[kind].map(x=>x.identity));expect(new Set(ids).size).toBe(ids.length);}
});
test('snapshot uses the main report denominator, not the N1 mirror date count',()=>{
 const snap=exportStudySnapshot(archive,'a'.repeat(40));expect(snap.totalDays).toBe(Object.keys(archive.lessons).length);expect(snap.lessons['2026-09-18'].grammar).toHaveLength(7);expect(snap.sourceCommit).toBe('a'.repeat(40));
});
