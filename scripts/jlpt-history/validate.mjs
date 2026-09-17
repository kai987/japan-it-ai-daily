import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentDates, readContent } from '../content-files.mjs';
import { auditVocabularyHistory } from './identity.mjs';

export function vocabularyHeadings(body) {
  const block = body.match(/^#{1,6}\s+C-1[.．][^\n]*\n([\s\S]*?)(?=^#{1,6}\s+C-2[.．])/m)?.[1];
  if (block === undefined) throw new Error('Daily C-1/C-2 boundaries missing');
  return [...block.matchAll(/^(?:#{2,6}\s+\d+\.\s*|\d+\.\s*\*\*)(.+?)（/gm)].map((m) => m[1].trim());
}
export function selectedVocabulary(body) {
  const tail = body.match(/^#{1,6}\s+C-4[.．][^\n]*\n([\s\S]*)$/m)?.[1];
  if (tail === undefined) throw new Error('Daily C-4 missing');
  const boundary = tail.search(/^(?:#{1,6}\s+[^\n]*(?:语法|語法|文法)|\*\*[^\n]*(?:语法|語法|文法)[^\n]*\*\*)/m);
  if (boundary < 0) throw new Error('Daily C-4 grammar boundary missing');
  const block = tail.slice(0, boundary);
  const inline = block.match(/\*\*\d+\s*(?:重点词|重点語|語)[：:]\*\*\s*([^\n]*)/);
  if (inline) return inline[1].split('・').map((s) => s.trim()).filter(Boolean);
  return [...block.matchAll(/^-\s+`([^`]+)`\s*$/gm)].map((m) => m[1]);
}
export function validateVocabularyHistory(root) {
  const config = JSON.parse(readFileSync(join(root, 'scripts/jlpt-history/identity-config.json'), 'utf8'));
  const dates = contentDates(root);
  if (!dates.length) throw new Error('No historical content');
  const errors = [], days = [];
  for (const date of dates) {
    try {
      const zh = readContent(root, 'japanese', date).data;
      const ja = readContent(root, 'japanese-ja', date).data;
      if (!Array.isArray(zh.vocabulary) || !Array.isArray(ja.vocabulary)) throw new Error('Missing structured vocabulary');
      const terms = zh.vocabulary.map((v) => v.term);
      if (JSON.stringify(terms) !== JSON.stringify(ja.vocabulary.map((v) => v.term))) throw new Error('Bilingual vocabulary differs');
      for (const collection of ['daily', 'daily-ja']) {
        const body = readContent(root, collection, date).body;
        const actual = vocabularyHeadings(body);
        if (JSON.stringify(selectedVocabulary(body)) !== JSON.stringify(zh.mustRememberWords)) errors.push(`${date}: ${collection} C-4 differs from selected vocabulary`);
        if (JSON.stringify(actual) !== JSON.stringify(terms)) errors.push(`${date}: ${collection} C-1 differs from structured vocabulary`);
      }
      days.push({ date, vocabulary: zh.vocabulary });
    } catch (error) { errors.push(`${date}: ${error.message}`); }
  }
  const audit = auditVocabularyHistory(days, config);
  for (const duplicate of audit.duplicates) errors.push(`${duplicate.date}: repeated JLPT word ${duplicate.term}; first ${duplicate.firstDate} (${duplicate.firstTerm})`);
  return { dates: dates.length, unique: audit.unique, errors };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = validateVocabularyHistory(process.cwd());
  result.errors.forEach((e) => console.error(e));
  console.log(`JLPT history: ${result.dates} dates, ${result.unique} unique words, ${result.errors.length} error(s).`);
  if (result.errors.length) process.exitCode = 1;
}
