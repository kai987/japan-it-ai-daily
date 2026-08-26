import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const topItem = z.object({
  title: z.string(),
  source: z.string(),
  topic: z.string().optional(),
  why: z.string().optional(),
  url: z.string().url().optional()
});

const daily = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/daily' }),
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

const japanese = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/japanese' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    topics: z.array(z.string()).default([]),
    levels: z.array(z.enum(['N5/N4', 'N3', 'N2', 'N1', 'IT/AI'])).default([]),
    vocabularyCount: z.number().int().nonnegative().default(0),
    grammarCount: z.number().int().nonnegative().default(0)
  })
});

export const collections = { daily, japanese };
