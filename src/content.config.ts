import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const externalUrl = z.string().url().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}, 'External URLs must use http or https');

const topItem = z.object({
  title: z.string(),
  source: z.string(),
  topic: z.string().optional(),
  why: z.string().optional(),
  url: externalUrl.optional()
});

const daily = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/daily' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    topics: z.array(z.string()).default([]),
    sources: z.array(z.string()).default([]),
    top: z.array(topItem).default([]),
    featured: z.boolean().default(false)
  })
});

const level = z.enum(['N5/N4', 'N3', 'N2', 'N1', 'IT/AI']);

const vocabularyItem = z.object({
  term: z.string(),
  reading: z.string(),
  partOfSpeech: z.string(),
  meaningZh: z.string(),
  level,
  collocations: z.array(z.string()).default([]),
  noteZh: z.string(),
  exampleJa: z.string(),
  exampleZh: z.string().optional(),
  nuanceZh: z.string().optional()
});

const grammarItem = z.object({
  pattern: z.string(),
  level,
  meaningZh: z.string(),
  structure: z.string(),
  usageZh: z.string(),
  exampleJa: z.string(),
  exampleZh: z.string().optional(),
  noteZh: z.string().optional()
});

const technicalTermItem = z.object({
  term: z.string(),
  japanese: z.string().optional(),
  meaningZh: z.string(),
  contextZh: z.string()
});

const japanese = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/japanese' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    topics: z.array(z.string()).default([]),
    levels: z.array(level).default([]),
    vocabularyCount: z.number().int().nonnegative().default(0),
    grammarCount: z.number().int().nonnegative().default(0),
    vocabulary: z.array(vocabularyItem).default([]),
    grammar: z.array(grammarItem).default([]),
    technicalTerms: z.array(technicalTermItem).default([]),
    mustRememberWords: z.array(z.string()).default([]),
    mustRememberGrammar: z.array(z.string()).default([])
  })
});

export const collections = { daily, japanese };
