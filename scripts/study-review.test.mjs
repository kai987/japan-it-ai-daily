import {expect,test} from 'vitest';
import {buildStudyArchive,frequencyFor,issueNumbers,frequencyText,reviewCount,reviewLimits,REVIEW_POLICY} from './learning-review.mjs';
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

test('grammar is a 5–8 range, not an eight-item quota',()=>{
 for(const total of [5,6,7,8]) expect(reviewCount('grammar',2,total-2,'2026-09-18')+2).toBe(total);
 expect(reviewCount('grammar',0,3,'2026-09-18')).toBe(3);
 expect(reviewCount('grammar',5,0,'2026-09-18')).toBe(0);
 expect(reviewCount('grammar',8,20,'2026-09-18')).toBe(0);
 expect(reviewCount('grammar',9,20,'2026-09-18')).toBe(0); // Never delete source cards.
 expect(reviewCount('grammar',2,20,'2026-09-18')).toBe(6);
 expect(reviewLimits('grammar')).toMatchObject({minimum:5,maximum:8});
});
test('historical grammar is supplemented without retroactively adding vocabulary',()=>{
 let supplemented=0;
 for(const [date,day] of Object.entries(archive.lessons)) {
  if(date>=REVIEW_POLICY.effectiveFrom)continue;
  expect(day.zh.reviewVocabulary).toHaveLength(0);
  const count=day.zh.grammar.length+day.zh.reviewGrammar.length;
  expect(count).toBeLessThanOrEqual(8);
  if(day.zh.reviewGrammar.length)supplemented++;
  if(count<5)expect(day.zh.reviewGrammarNote?.length).toBeGreaterThan(20);
  else expect(day.zh.reviewGrammarNote).toBeUndefined();
 }
 expect(supplemented).toBeGreaterThan(25);
 expect(archive.lessons['2026-08-12'].zh.reviewGrammar).toHaveLength(0);
 expect(archive.lessons['2026-08-13'].zh.studyGrammarCount).toBe(6);
 expect(archive.lessons['2026-08-14'].zh.studyGrammarCount).toBe(5);
 expect(archive.lessons['2026-08-15'].zh.studyGrammarCount).toBe(3);
});
test('snapshot exports separate complete historical grammar without overwriting old vocabulary',()=>{
 const snapshot=exportStudySnapshot(archive,'a'.repeat(40));
 expect(Object.keys(snapshot.grammarLessons)).toEqual(Object.keys(archive.lessons));
 expect(snapshot.lessons['2026-09-09']).toBeUndefined();
 expect(snapshot.grammarLessons['2026-09-09'].grammar).toEqual([...archive.lessons['2026-09-09'].zh.grammar,...archive.lessons['2026-09-09'].zh.reviewGrammar]);
 expect(snapshot.grammarLessons['2026-08-15'].reviewGrammarNote).toBeTruthy();
});
