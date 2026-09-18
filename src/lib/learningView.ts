import type { CollectionEntry } from 'astro:content';
import { getStudyDay, titleWithIssue } from '../../scripts/learning-review.mjs';

// Normalize field names only. No cross-language fallback or prose translation.
export function learningView(lesson: CollectionEntry<'japanese'> | CollectionEntry<'japaneseJa'>) {
  const locale = lesson.collection === 'japaneseJa' ? 'ja' : 'zh';
  const study = getStudyDay(lesson.id, locale);
  const levels = [...new Set([...lesson.data.levels,...study.reviewVocabulary.map((x:any)=>x.level),...study.reviewGrammar.map((x:any)=>x.level)])];
  if (locale === 'ja') return { ...lesson.data, ...study, levels, title: titleWithIssue(lesson.data.title, lesson.id) };
  const data = lesson.data;
  return {
    ...data,
    ...study,
    levels,
    title: titleWithIssue(data.title, lesson.id),
    vocabulary: study.vocabulary.map((item: any) => ({
      ...item, meaning: item.meaningZh, note: item.noteZh,
      exampleMeaning: item.exampleZh, nuance: item.nuanceZh,
    })),
    grammar: study.grammar.map((item: any) => ({
      ...item, meaning: item.meaningZh, usage: item.usageZh,
      exampleMeaning: item.exampleZh, note: item.noteZh,
    })),
    technicalTerms: data.technicalTerms.map((item: any) => ({
      ...item, meaning: item.meaningZh, context: item.contextZh,
    })),
  };
}
