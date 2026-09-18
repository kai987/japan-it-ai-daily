import { getStudyArchive } from './learning-review.mjs';
export function exportStudySnapshot(archive=getStudyArchive(),sourceCommit=process.env.GITHUB_SHA || '') {
  const vocabularyFrequency={},grammarFrequency={},firstVocabulary={},firstGrammar={},lessons={};
  for(const [date,day] of Object.entries(archive.lessons)) {
    for(const item of day.zh.vocabulary) {vocabularyFrequency[item.identity]=item.reportFrequency;vocabularyFrequency[item.term]=item.reportFrequency;firstVocabulary[item.identity]=item.firstIntroducedDate;}
    for(const item of day.zh.grammar) {grammarFrequency[item.identity]=item.reportFrequency;firstGrammar[item.identity]=item.firstIntroducedDate;}
    if(date>=archive.policy.effectiveFrom) lessons[date]={issueNumber:day.issueNumber,
      vocabulary:[...day.zh.vocabulary,...day.zh.reviewVocabulary],grammar:[...day.zh.grammar,...day.zh.reviewGrammar],
      reviewVocabularyNote:day.zh.reviewVocabularyNote,reviewGrammarNote:day.zh.reviewGrammarNote,
    };
  }
  return {schemaVersion:1,sourceCommit,frequencyScope:archive.frequencyScope,policy:archive.policy,
    totalDays:archive.totalDays,firstDate:archive.firstDate,lastDate:archive.lastDate,issueNumbers:archive.issueNumbers,
    vocabularyFrequency,grammarFrequency,firstVocabulary,firstGrammar,lessons};
}
