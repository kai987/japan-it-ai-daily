import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import picomatch from 'picomatch';

const patchedEntry = fileURLToPath(new URL('../../vendor/picomatch/index.js', import.meta.url));

describe('local picomatch security patch', () => {
  it.each(['astro', '@astrojs/internal-helpers/create-filter', 'anymatch', 'fdir', 'tinyglobby', 'vite', 'vitest'])(
    '%s resolves the vetted local implementation',
    (consumer) => {
      const requireFromConsumer = createRequire(import.meta.resolve(consumer));
      expect(realpathSync(requireFromConsumer.resolve('picomatch'))).toBe(realpathSync(patchedEntry));
    },
  );

  it.each([{}, { maxExtglobRecursion: false }, { capture: true }])(
    'keeps variable-width repeated alternatives literal with options %j',
    (options) => {
      const glob = 'notes/+(draft|finalized).md';
      const match = picomatch(glob, options);
      expect(match(glob)).toBe(true);
      expect(match('notes/draftfinalized.md')).toBe(false);
      expect(picomatch.parse(glob, options).output).toContain('\\+\\(draft\\|finalized\\)');
    },
  );

  it('quotes wildcard tokens inside repeated groups', () => {
    const glob = 'notes/+(draft*).md';
    const parsed = picomatch.parse(glob, { maxExtglobRecursion: false });
    expect(parsed.output).toContain('\\+\\(draft\\*\\)');
  });

  it('preserves fixed-width repetition and ordinary content globs', () => {
    expect(picomatch('notes/+(draft|final).md')('notes/draftfinal.md')).toBe(true);
    expect(picomatch('src/content/**/*.{md,mdx}')('src/content/japanese/2026-11-18.md')).toBe(true);
    expect(picomatch('src/content/**/!(*.draft).md')('src/content/japanese/2026-11-18.draft.md')).toBe(false);
    expect(picomatch('src/content/**/!(*.draft).md')('src/content/japanese/2026-11-18.md')).toBe(true);
  });

  it('preserves anymatch include and exclude behavior for file watchers', () => {
    const require = createRequire(import.meta.url);
    const anymatch = require('anymatch');
    const matches = anymatch(['**/*.{md,json}', '!**/*.tmp.md']);
    expect(matches('src/content/daily/2026-11-18.md')).toBe(true);
    expect(matches('src/content/daily/2026-11-18.tmp.md')).toBe(false);
    expect(matches('src\\content\\evidence\\2026-11-18.json')).toBe(true);
  });
});
