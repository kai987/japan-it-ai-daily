import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const daily = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/daily' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    topics: z.array(z.string()).default([]),
    sources: z.array(z.string()).default([]),
    featured: z.boolean().default(false)
  })
});

export const collections = { daily };
