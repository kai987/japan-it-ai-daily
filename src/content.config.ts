import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const externalUrl = z.url({ protocol: /^https?$/ });

const topItem = z.object({
  title: z.string(),
  source: z.string(),
  topic: z.string().optional(),
  why: z.string().optional(),
  url: externalUrl.optional()
});

const dailySchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  description: z.string(),
  topics: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  top: z.array(topItem).default([]),
  featured: z.boolean().default(false)
});

const daily = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/daily' }),
  schema: dailySchema
});

const dailyJa = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/daily-ja' }),
  schema: dailySchema
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

const japaneseSchema = z.object({
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
});

const japanese = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/japanese' }),
  schema: japaneseSchema
});

const vocabularyItemJa = z.object({
  term: z.string(),
  reading: z.string(),
  partOfSpeech: z.string(),
  meaning: z.string(),
  level,
  collocations: z.array(z.string()).default([]),
  note: z.string(),
  exampleJa: z.string(),
  exampleMeaning: z.string().optional(),
  nuance: z.string().optional()
});

const grammarItemJa = z.object({
  pattern: z.string(),
  level,
  meaning: z.string(),
  structure: z.string(),
  usage: z.string(),
  exampleJa: z.string(),
  exampleMeaning: z.string().optional(),
  note: z.string().optional()
});

const technicalTermItemJa = z.object({
  term: z.string(),
  japanese: z.string().optional(),
  meaning: z.string(),
  context: z.string()
});

const japaneseJa = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/japanese-ja' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    topics: z.array(z.string()).default([]),
    levels: z.array(level).default([]),
    vocabularyCount: z.number().int().nonnegative().default(0),
    grammarCount: z.number().int().nonnegative().default(0),
    vocabulary: z.array(vocabularyItemJa).default([]),
    grammar: z.array(grammarItemJa).default([]),
    technicalTerms: z.array(technicalTermItemJa).default([]),
    mustRememberWords: z.array(z.string()).default([]),
    mustRememberGrammar: z.array(z.string()).default([])
  })
});

export const collections = { daily, dailyJa, japanese, japaneseJa };
