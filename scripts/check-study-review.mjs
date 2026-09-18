import {buildStudyArchive} from './learning-review.mjs';
const archive=buildStudyArchive();
for(const [date,day] of Object.entries(archive.lessons)) for(const locale of ['zh','ja']) for(const kind of ['Vocabulary','Grammar']) {
 const fresh=day[locale][kind.toLowerCase()],review=day[locale]['review'+kind];
 const identities=new Set(fresh.map(x=>x.identity));
 for(const card of review){
  if(identities.has(card.identity)||card.firstIntroducedDate>=date||!card.reviewEvidence?.excerpt.includes(card.reviewEvidence.form))throw new Error(`${date}: invalid review ${card.identity}`);
  identities.add(card.identity);
 }
 const target=kind==='Vocabulary'?20:7;
 if(date>=archive.policy.effectiveFrom && identities.size<target && !day[locale]['review'+kind+'Note'])throw new Error(`${date}: unexplained review shortfall`);
 for(const card of [...fresh,...review]){
  const f=card.reportFrequency;
  if(f.totalDays!==archive.totalDays||f.appearedDays!==new Set(f.appearedDates).size||f.percent!==Number((f.appearedDays/f.totalDays*100).toFixed(1)))throw new Error(`${date}: inaccurate frequency`);
 }
}
console.log(`Study review PASS: ${archive.totalDays} report dates; new identities remain unique, reviews have earlier introductions and current-report evidence; frequencies and issue numbers validated.`);
