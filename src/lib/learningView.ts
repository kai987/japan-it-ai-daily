import type { CollectionEntry } from 'astro:content';

// Normalize field names only. No cross-language fallback or prose translation.
export function learningView(lesson: CollectionEntry<'japanese'> | CollectionEntry<'japaneseJa'>) {
  if (lesson.collection === 'japaneseJa') return lesson.data;
  const data = lesson.data;
  return {
    ...data,
    vocabulary: data.vocabulary.map((item) => ({
      ...item, meaning: item.meaningZh, note: item.noteZh,
      exampleMeaning: item.exampleZh, nuance: item.nuanceZh,
    })),
    grammar: data.grammar.map((item) => ({
      ...item, meaning: item.meaningZh, usage: item.usageZh,
      exampleMeaning: item.exampleZh, note: item.noteZh,
    })),
    technicalTerms: data.technicalTerms.map((item) => ({
      ...item, meaning: item.meaningZh, context: item.contextZh,
    })),
  };
}
