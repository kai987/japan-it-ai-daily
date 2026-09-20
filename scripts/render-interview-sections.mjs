import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readContent } from './content-files.mjs';
import { readStructuredInterview } from './structured-interview.mjs';
import { validateStructuredInterview } from '../src/lib/structuredInterview.mjs';

/** Authoring output only: never rewrites either language's source documents.
 * Both sections are generated from the canonical JSON, not translated from a
 * Chinese report. Only article titles/IDs come from the report frontmatter.
 */
export function renderInterviewSections(record, top, locale) {
  if (!['zh', 'ja'].includes(locale)) throw new Error('Locale must be zh or ja');
  validateStructuredInterview(record, record.date);
  if (top.length !== record.interview.length
    || record.interview.some((item, index) => !item.articleIds.includes(top[index].articleId))) {
    throw new Error(`${record.date}: article order does not match canonical interviews`);
  }
  const titles = new Map(top.map(item => [item.articleId, item.title]));
  const interview = ['## 3. 面接で使えるポイント', ...record.interview.map((item, index) => [
    `### ${index + 1}. ${titles.get(top[index].articleId)}`,
    locale === 'ja' ? '**面接質問：**' : '**面试问题：**',
    `> ${item.question}`,
    locale === 'ja' ? '**約30秒回答：**' : '**约30秒回答：**',
    `> ${item.answer}`,
  ].join('\n\n'))].join('\n\n');
  const review = [locale === 'ja' ? '## 5. 面接復習カード' : '## 5. 面试复习卡',
    ...record.review.map((item, index) => [
      `### Q${index + 1}`, `> ${item.question}`, `**回答要点：** ${item.points[locale]}`,
    ].join('\n\n'))].join('\n\n');
  return { interview: `${interview}\n`, review: `${review}\n` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const options = {};
    for (let index = 0; index < args.length; index += 2) {
      const key = args[index];
      if (!['--date', '--locale', '--section'].includes(key) || !args[index + 1]
        || options[key] !== undefined) throw new Error('Usage: --date YYYY-MM-DD --locale zh|ja [--section interview|review]');
      options[key] = args[index + 1];
    }
    const date = options['--date'];
    const locale = options['--locale'];
    const section = options['--section'];
    if (!['zh', 'ja'].includes(locale) || (section && !['interview', 'review'].includes(section))) {
      throw new Error('Specify --locale zh|ja and optionally --section interview|review');
    }
    const record = readStructuredInterview(date);
    if (!record) throw new Error(`${date}: no canonical interview record`);
    const { data } = readContent(process.cwd(), locale === 'ja' ? 'daily-ja' : 'daily', date);
    const sections = renderInterviewSections(record, data.top, locale);
    process.stdout.write(section ? sections[section] : `${sections.interview}\n${sections.review}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
