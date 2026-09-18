import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readContent } from './content-files.mjs';
import { readStructuredInterview, structuredInterviewDates } from './structured-interview.mjs';

const visibleText = (text) => text.replace(/^\s*>\s?/gm, '').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();

// Transitional report mirrors must retain canonical text/order, but headings,
// blockquote markers, emphasis and line wrapping are not business identifiers.
export function assertInterviewMirror(record, body, locale) {
  const haystack = visibleText(body);
  const values = [
    ...record.interview.flatMap(item => [item.question, item.answer]),
    ...record.review.flatMap(item => [item.question, item.points[locale]]),
  ];
  let cursor = 0;
  for (const value of values) {
    const needle = visibleText(value);
    const index = haystack.indexOf(needle, cursor);
    if (index < 0) throw new Error(`${record.date}/${locale}: missing, changed or reordered interview mirror: ${value.slice(0, 45)}`);
    cursor = index + needle.length;
  }
}

export function validateStructuredInterviews(root = process.cwd()) {
  const dates = structuredInterviewDates(root);
  if (!dates.length) throw new Error('No structured interview pilot found');
  for (const date of dates) {
    const record = readStructuredInterview(date, root);
    if (!record) throw new Error(`${date}: missing structured interview`);
    for (const [locale, dir] of [['zh', 'daily'], ['ja', 'daily-ja']]) {
      const { data, body } = readContent(root, dir, date);
      const articleIds = data.top.map(item => item.articleId);
      if (String(data.date) !== date || articleIds.length !== record.interview.length
        || record.interview.some((item, index) => !item.articleIds.includes(articleIds[index]))) {
        throw new Error(`${date}/${locale}: article order/date does not match the report`);
      }
      for (const item of [...record.interview, ...record.review]) {
        if (item.articleIds.some(id => !articleIds.includes(id))) throw new Error(`${date}/${item.id}: unknown article reference`);
      }
      assertInterviewMirror(record, body, locale);
    }
  }
  return { dates: dates.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = validateStructuredInterviews();
    console.log(`Structured interviews PASS: ${result.dates} date(s); schema, required files, article references and bilingual mirror text/order checked.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
