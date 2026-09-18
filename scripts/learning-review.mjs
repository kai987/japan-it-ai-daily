import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentDates, contentDirs, readContent } from './content-files.mjs';
import { makeLexicalKey } from './check-jlpt-history.mjs';
import { makeGrammarKey } from './check-grammar-history.mjs';

export const REVIEW_POLICY = { effectiveFrom: '2026-09-18', vocabularyTarget: 20, grammarTarget: 7 };
export const FREQUENCY_SCOPE = '日文日报正文、推荐理由及学习卡片（新学＋复习）；同一天和中日镜像只计一次。不含外链全文。';
const clean = (s = '') => s.normalize('NFKC').replace(/\*\*|`/g, '').replace(/\s+/gu, ' ').trim();
const escaped = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const dateOf = value => value instanceof Date ? value.toISOString().slice(0,10) : String(value).slice(0,10);
export function issueNumbers(dates) {
  return Object.fromEntries([...new Set(dates.map(dateOf))].sort().map((date, i) => [date, i + 1]));
}
export function frequencyFor(dates, totalDays, appearanceForms = new Map()) {
  const appearedDates = [...new Set(dates)].sort();
  if (!Number.isInteger(totalDays) || totalDays < 1 || appearedDates.length > totalDays) throw new Error('Invalid report-frequency denominator');
  const forms = Object.fromEntries(appearedDates.map(date => [date, appearanceForms.get(date)]).filter(([, form]) => typeof form === 'string' && form.length));
  const frequency = { appearedDays: appearedDates.length, totalDays, percent: Number((appearedDates.length / totalDays * 100).toFixed(1)), appearedDates };
  return Object.keys(forms).length ? { ...frequency, appearanceForms: forms } : frequency;
}
export function frequencyText(frequency, locale = 'zh') {
  return `${locale === 'ja' ? '出現頻度' : '出现频率'}：${frequency.percent.toFixed(1)}%（${frequency.appearedDays}/${frequency.totalDays}${locale === 'ja' ? '日' : '天'}）`;
}
function formsFor(card, kind, rules, key) {
  const label = kind === 'vocabulary' ? card.term : card.pattern;
  const id = key(label);
  const forms = new Set([id, clean(label).replace(/[~～〜…]/gu, '')]);
  for (const [form, target] of Object.entries(rules.aliases || {})) if (key(target) === id) forms.add(form);
  if (kind === 'vocabulary') {
    // サ変名詞の活用は名詞部分で照合。五段は長い語だけ、明示された活用語幹を使う。
    if (/する$/.test(label)) forms.add(label.slice(0, -2));
    const endings = { 'う':['い','わ','え','お','った','って'], 'く':['き','か','け','こ','いた','いて'], 'ぐ':['ぎ','が','げ','ご','いだ','いで'], 'す':['し','さ','せ','そ','した','して'], 'つ':['ち','た','て','と','った','って'], 'ぬ':['に','な','ね','の','んだ','んで'], 'ぶ':['び','ば','べ','ぼ','んだ','んで'], 'む':['み','ま','め','も','んだ','んで'], 'る':['り','ら','れ','ろ','った','って'] };
    if ((card.partOfSpeech || '').includes('五段') && label.length >= 4) for (const end of endings[label.at(-1)] || []) forms.add(label.slice(0,-1) + end);
  } else if (id === 'ために') {