# Japan IT / AI Daily

A daily static knowledge site for Japanese IT/AI news, AI engineer interview preparation, and technical Japanese study.

## Stack

- Astro 5
- Markdown / MDX content collection
- GitHub Pages
- GitHub Actions

## Local development

```bash
npm install
npm run dev
```

## Content model

Daily reports live in:

```text
src/content/daily/YYYY-MM-DD.md
```

Each report contains:

- A. 详细文字版
- B. 重点总结和面试可用的知识点
- C. 日本語学习｜JLPT + IT日本語

The homepage and archive are generated automatically from the content collection.

## GitHub Pages

The repository includes `.github/workflows/deploy.yml`. In GitHub, set **Settings → Pages → Source** to **GitHub Actions** once. After that, every push to `main` rebuilds and publishes the site.

Expected public URL:

`https://kai987.github.io/japan-it-ai-daily/`

## Daily update convention

Recommended commit message:

```text
content: add daily report for YYYY-MM-DD
```
