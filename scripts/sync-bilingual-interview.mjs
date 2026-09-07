import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root = resolve(process.cwd());
const zhDir = join(root, 'src', 'content', 'daily');
const jaDir = join(root, 'src', 'content', 'daily-ja');
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');

const normalize = (value = '') => value.replace(/\r\n/g, '\n').trim();

const sectionRange = (source, title) => {
  const lines = source.split(/\r?\n/);
  let start = -1;
  let depth = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;
    if ((match[2] || '').includes(title)) {
      start = i;
      depth = match[1].length;
      break;
    }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match && match[1].length <= depth) {
      end = i;
      break;
    }
  }
  return { lines, start, end };
};

const classifyLabel = (line) => {
  const compact = line.replace(/\s+/g, '');
  if (/^\*\*.*(?:面试问题|面接質問|質問).*：?\*\*$/.test(compact)) return 'question';
  if (/^\*\*.*(?:30秒|３０秒).*回答.*：?\*\*$/.test(compact)) return 'answer';
  return null;
};

const readValueAfterLabel = (lines, labelIndex, end) => {
  let i = labelIndex + 1;
  while (i < end && !lines[i].trim()) i += 1;
  if (i >= end) return { text: '', end: i };

  if (lines[i].trim().startsWith('>')) {
    const value = [];
    while (i < end && lines[i].trim().startsWith('>')) {
      value.push(lines[i].replace(/^\s*>\s?/, ''));
      i += 1;
    }
    return { text: normalize(value.join('\n')), end: i };
  }

  const value = [];
  while (i < end) {
    const trimmed = lines[i].trim();
    if (!trimmed) break;
    if (/^#{1,6}\s+/.test(trimmed) || /^\*\*/.test(trimmed)) break;
    value.push(lines[i]);
    i += 1;
  }
  return { text: normalize(value.join('\n')), end: i };
};

const topicRanges = (lines, start, end) => {
  const starts = [];
  for (let i = start + 1; i < end; i += 1) {
    if (/^###\s+/.test(lines[i])) starts.push(i);
  }
  return starts.map((topicStart, index) => ({
    start: topicStart,
    end: starts[index + 1] ?? end,
  }));
};

const extractTopicQa = (lines, start, end) => {
  let question = '';
  let answer = '';
  for (let i = start + 1; i < end; i += 1) {
    const type = classifyLabel(lines[i].trim());
    if (!type) continue;
    const value = readValueAfterLabel(lines, i, end);
    if (type === 'question') question = value.text;
    if (type === 'answer') answer = value.text;
  }
  return { question, answer };
};

const extractPairs = (source) => {
  const range = sectionRange(source, '面接で使えるポイント');
  if (!range) return [];
  const topics = topicRanges(range.lines, range.start, range.end);
  return topics.map((topic) => extractTopicQa(range.lines, topic.start, topic.end));
};

const samePairs = (expected, actual) => expected.length === actual.length
  && expected.every((item, index) => (
    item.question === actual[index]?.question
    && item.answer === actual[index]?.answer
  ));

const suffixAfterAnswer = (lines, start, end) => {
  let answerLabel = -1;
  for (let i = start + 1; i < end; i += 1) {
    if (classifyLabel(lines[i].trim()) === 'answer') {
      answerLabel = i;
      break;
    }
  }

  if (answerLabel >= 0) {
    const value = readValueAfterLabel(lines, answerLabel, end);
    let suffixStart = value.end;
    while (suffixStart < end && !lines[suffixStart].trim()) suffixStart += 1;
    return lines.slice(suffixStart, end);
  }

  const fallback = lines.findIndex((line, index) => (
    index > start
    && /^\*\*.*(?:可关联|可關聯|関連|关键词|關鍵詞|キーワード)/.test(line.trim())
  ));
  return fallback >= 0 ? lines.slice(fallback, end) : [];
};

const quoteLines = (text) => text.split('\n').map((line) => `> ${line}`);

const replaceSectionQa = (source, expected, date) => {
  const range = sectionRange(source, '面接で使えるポイント');
  if (!range) throw new Error(`${date}: 日语版缺少「面接で使えるポイント」`);
  const { lines, start, end } = range;
  const topics = topicRanges(lines, start, end);

  if (topics.length !== expected.length) {
    throw new Error(`${date}: 話題数量不一致：中文 ${expected.length} / 日语 ${topics.length}`);
  }

  const preambleEnd = topics[0]?.start ?? end;
  const rebuilt = [lines[start], ...lines.slice(start + 1, preambleEnd)];

  topics.forEach((topic, index) => {
    const pair = expected[index];
    if (!pair?.question || !pair?.answer) {
      throw new Error(`${date}: 中文模式第 ${index + 1} 个話題缺少質問或30秒回答`);
    }
    const heading = lines[topic.start];
    const suffix = suffixAfterAnswer(lines, topic.start, topic.end);

    while (rebuilt.length && !rebuilt.at(-1).trim()) rebuilt.pop();
    rebuilt.push(
      '',
      heading,
      '',
      '**質問：**',
      '',
      ...quoteLines(pair.question),
      '',
      '**30秒回答：**',
      '',
      ...quoteLines(pair.answer),
    );

    if (suffix.length) {
      rebuilt.push('');
      while (suffix.length && !suffix[0].trim()) suffix.shift();
      rebuilt.push(...suffix);
    }
  });

  while (rebuilt.length && !rebuilt.at(-1).trim()) rebuilt.pop();
  const next = [...lines.slice(0, start), ...rebuilt, '', ...lines.slice(end)].join('\n');
  const actual = extractPairs(next);
  if (!samePairs(expected, actual)) {
    throw new Error(`${date}: 同步后 Q&A 校验失败`);
  }
  return next;
};

const dates = readdirSync(zhDir)
  .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
  .map((name) => basename(name, '.md'))
  .sort();

let changed = 0;
let checked = 0;
const mismatches = [];

for (const date of dates) {
  const zhPath = join(zhDir, `${date}.md`);
  const jaPath = join(jaDir, `${date}.md`);
  if (!existsSync(jaPath)) continue;

  const zhSource = readFileSync(zhPath, 'utf8');
  const jaSource = readFileSync(jaPath, 'utf8');
  const expected = extractPairs(zhSource);
  if (!expected.length) continue;
  if (expected.some((item) => !item.question || !item.answer)) {
    throw new Error(`${date}: 中文模式存在缺少質問或30秒回答的話題`);
  }
  checked += 1;

  const actual = extractPairs(jaSource);
  if (samePairs(expected, actual)) continue;

  mismatches.push(date);
  if (!checkOnly) {
    const next = replaceSectionQa(jaSource, expected, date);
    writeFileSync(jaPath, next, 'utf8');
    changed += 1;
  }
}

if (checkOnly && mismatches.length) {
  console.error(`Bilingual interview Q&A mismatch on ${mismatches.length} date(s): ${mismatches.join(', ')}`);
  process.exit(1);
}

console.log(`Checked ${checked} bilingual report pair(s).`);
if (checkOnly) console.log('All interview questions and 30-second answers are identical.');
else console.log(`Updated ${changed} Japanese report(s): ${mismatches.join(', ') || 'none'}`);
