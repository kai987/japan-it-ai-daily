import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentDates, contentDirs, readContent } from './content-files.mjs';

export function makeLexicalKey(rules) {
  const aliases = rules.aliases || {}, stems = new Set(rules.naStems || []);
  return (value) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Empty vocabulary identity');
    let term = value.normalize('NFKC').replace(/[\s\u200b\ufeff]+/gu, '');
    term = aliases[term] || term;
    if (term.endsWith('する')) term = term.slice(0, -2);
    if (/[なに]$/.test(term) && (stems.has(term.slice(0, -1)) || term.slice(-2, -1) === '的')) term = term.slice(0, -1);
    return aliases[term] || term;
  };
}
export function checkDays(days, key) {
  if (!days.length) throw new Error('No history loaded; absence is not a successful deduplication');
  const seen = new Map();
  for (const { date, vocabulary, mustRememberWords } of days) {
    if (!Array.isArray(vocabulary) || !vocabulary.length) throw new Error(`${date}: missing vocabulary`);
    const current = new Set();
    for (const card of vocabulary) {
      const id = key(card.term);
      if (current.has(id)) throw new Error(`${date}: duplicate within day: ${card.term}`);
      if (seen.has(id)) throw new Error(`${date}: ${card.term} already introduced on ${seen.get(id)}`);
      current.add(id); seen.set(id, date);
    }
    if (!Array.isArray(mustRememberWords)) throw new Error(`${date}: missing must-remember list`);
    const must = mustRememberWords.map(key);
    if (new Set(must).size !== must.length || must.some((id) => !current.has(id))) throw new Error(`${date}: invalid C-4 vocabulary subset`);
  }
  return { dates: days.length, vocabulary: seen.size, duplicates: 0 };
}
const identity = (v) => [v.term, v.reading, v.level];
const exact = (a, b, label) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${label}: bilingual identity mismatch`); };
export function c1Terms(body) {
  const section = body.match(/^## C-1[^\n]*\n([\s\S]*?)(?=^## C-2\b)/m)?.[1];
  if (!section) throw new Error('Missing daily C-1 section');
  const headings = [...section.matchAll(/^### (?:C-1-)?\d+\.\s+([^\n（(]+)/gm)].map((m) => m[1].trim());
  if (headings.length) return headings;
  // List-style cards may omit redundant furigana for kana-only terms such as 「とどまる」.
  // Capture the term up to either a reading parenthesis or the level separator, then let the
  // canonical bilingual identity comparison below remain the source of truth.
  return [...section.matchAll(/^\d+\.\s+\*\*(.+?)(?=[（(｜|])/gm)].map((m) => m[1].trim());
}
function c4Words(body) {
  const section = body.match(/^## C-4[^\n]*\n([\s\S]*)/m)?.[1];
  if (!section) throw new Error('Missing daily C-4 section');
  const line = section.match(/^(?:- )?\*\*(?:10\s*(?:語|词)|词汇\s*10\s*个|語彙\s*10\s*語)[：:]\*\*\s*(.+)$/m)?.[1];
  if (line) return line.replace(/`/g, '').trim().split(/・|\s+\/\s+/).map((x) => x.trim());
  // Legacy first day's C-4 uses a numbered list under its own heading.
  const legacy = section.match(/### 10 个重点词\s*\n([\s\S]*?)(?=###|$)/)?.[1];
  if (legacy) return [...legacy.matchAll(/^(?:\d+\.|-)\s+(.+)/gm)].map((m) => m[1].replace(/\*\*|`/g, '').split(/[（(｜|]/)[0].trim());
  throw new Error('Unrecognized C-4 words format');
}
export function checkHistory(root) {
  const rules = JSON.parse(readFileSync(join(root, 'docs/jlpt-history/identity-rules.json'), 'utf8'));
  const key = makeLexicalKey(rules), dates = contentDates(root), days = [];
  // Read every date in all four directories; missing/invalid history is fatal.
  for (const date of dates) {
    const files = Object.fromEntries(contentDirs.map((dir) => [dir, readContent(root, dir, date)]));
    const zh = files.japanese.data, ja = files['japanese-ja'].data;
    exact(zh.vocabulary.map(identity), ja.vocabulary.map(identity), date);
    exact(zh.mustRememberWords, ja.mustRememberWords, `${date} C-4`);
    if (zh.vocabularyCount !== zh.vocabulary.length || ja.vocabularyCount !== ja.vocabulary.length) throw new Error(`${date}: incorrect vocabularyCount`);
    for (const dir of ['daily', 'daily-ja']) {
      exact(c1Terms(files[dir].body), zh.vocabulary.map((v) => v.term), `${dir}/${date} C-1`);
      exact(c4Words(files[dir].body), zh.mustRememberWords, `${dir}/${date} C-4`);
    }
    days.push({ date, vocabulary: zh.vocabulary, mustRememberWords: zh.mustRememberWords });
  }
  return checkDays(days, key);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = checkHistory(process.cwd());
  console.log(`JLPT history: all ${result.dates} dates / four representations checked; ${result.vocabulary} lexical identities; ${result.duplicates} cross-date duplicates.`);
}
