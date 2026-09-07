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

const extractQa = (source) => {
  const range = sectionRange(source, '面接で使えるポイント');
  if (!range) return [];
  const { lines, start, end } = range;
  const out = [];
  let pending = null;
  for (let i = start + 1; i < end; i += 1) {
    const type = classifyLabel(lines[i].trim());
    if (type) {
      pending = type;
      continue;
    }
    if (!pending) continue;
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (!trimmed.startsWith('>')) {
      if (/^#{1,6}\s+/.test(trimmed) || /^\*\*/.test(trimmed)) pending = null;
      continue;
    }
    const block = [];
    let j = i;
    while (j < end && lines[j].trim().startsWith('>')) {
      block.push(lines[j].replace(/^\s*>\s?/, ''));
      j += 1;
    }
    out.push({ type: pending, text: normalize(block.join('\n')) });
    pending = null;
    i = j - 1;
  }
  return out;
};

const replaceQa = (source, expected) => {
  const range = sectionRange(source, '面接で使えるポイント');
  if (!range) throw new Error('日语版缺少「面接で使えるポイント」');
  const { lines, start, end } = range;
  const slots = [];
  let pending = null;
  for (let i = start + 1; i < end; i += 1) {
    const type = classifyLabel(lines[i].trim());
    if (type) {
      pending = type;
      continue;
    }
    if (!pending) continue;
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (!trimmed.startsWith('>')) {
      if (/^#{1,6}\s+/.test(trimmed) || /^\*\*/.test(trimmed)) pending = null;
      continue;
    }
    let j = i;
    while (j < end && lines[j].trim().startsWith('>')) j += 1;
    slots.push({ type: pending, from: i, to: j });
    pending = null;
    i = j - 1;
  }

  if (slots.length !== expected.length) {
    throw new Error(`Q&A 数量不一致：中文 ${expected.length} / 日语 ${slots.length}`);
  }
  for (let i = 0; i < slots.length; i += 1) {
    if (slots[i].type !== expected[i].type) {
      throw new Error(`Q&A 类型顺序不一致：第 ${i + 1} 项中文=${expected[i].type} 日语=${slots[i].type}`);
    }
  }

  const next = [...lines];
  for (let i = slots.length - 1; i >= 0; i -= 1) {
    const slot = slots[i];
    const replacement = expected[i].text.split('\n').map((line) => `> ${line}`);
    next.splice(slot.from, slot.to - slot.from, ...replacement);
  }
  return next.join('\n');
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
  const expected = extractQa(zhSource);
  const actual = extractQa(jaSource);
  if (!expected.length) continue;
  checked += 1;

  const same = expected.length === actual.length
    && expected.every((item, index) => item.type === actual[index]?.type && item.text === actual[index]?.text);
  if (same) continue;

  mismatches.push(date);
  if (!checkOnly) {
    const next = replaceQa(jaSource, expected);
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
