import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://kai987.github.io',
  base: '/japan-it-ai-daily/',
  trailingSlash: 'always',
  integrations: [mdx()],
  markdown: {
    shikiConfig: { theme: 'github-light' }
  }
});
