import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://kai987.github.io',
  base: '/japan-it-ai-daily/',
  trailingSlash: 'always',
  markdown: {
    shikiConfig: { theme: 'github-light' }
  }
});
