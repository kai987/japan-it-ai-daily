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
  meaningJa: z.string().optional(),
  level,
  collocations: z.array(z.string()).default([]),
  noteZh: z.string(),
  noteJa: z.string().optional(),
  exampleJa: z.string(),
  exampleZh: z.string().optional(),
  nuanceZh: z.string().optional(),
  nuanceJa: z.string().optional()
});

const grammarItem = z.object({
  pattern: z.string(),
  level,
  meaningZh: z.string(),
  meaningJa: z.string().optional(),
  structure: z.string(),
  usageZh: z.string(),
  usageJa: z.string().optional(),
  exampleJa: z.string(),
  exampleZh: z.string().optional(),
  noteZh: z.string().optional(),
  noteJa: z.string().optional()
});

const technicalTermItem = z.object({
  term: z.string(),
  japanese: z.string().optional(),
  meaningZh: z.string(),
  meaningJa: z.string().optional(),
  contextZh: z.string(),
  contextJa: z.string().optional()
});

const japanese = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/japanese' }),
  schema: z.object({
    title: z.string(),
    titleJa: z.string().optional(),
    date: z.coerce.date(),
    description: z.string(),
    descriptionJa: z.string().optional(),
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

export const collections = { daily, dailyJa, japanese };
