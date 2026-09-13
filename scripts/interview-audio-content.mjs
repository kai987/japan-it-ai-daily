const normalizeText = (value = '') => value.replace(/^>\s?/gm, '').replace(/\s+/g, ' ').trim();

const extractSection = (source, title) => {
  const lines = source.split(/\r?\n/);
  let start = -1;
  let depth = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;
    if ((match[2] || '').includes(title)) {
      start = i + 1;
      depth = match[1].length;
      break;
    }
  }
  if (start < 0) return '';
  const out = [];
  for (let i = start; i < lines.length; i += 1) {
    const heading = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (heading && heading[1].length <= depth) break;
    out.push(lines[i]);
  }
  return out.join('\n');
};

const quoteBlocks = (section) => {
  const lines = section.split(/\r?\n/);
  const blocks = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const text = normalizeText(current.join('\n'));
    if (text) blocks.push(text);
    current = [];
  };
  for (const line of lines) {
    if (/^>\s?/.test(line.trim())) current.push(line.trim());
    else flush();
  }
  flush();
  return blocks;
};

export const parseInterview = (source) => {
  const section = extractSection(source, '面接で使えるポイント');
  if (!section) return [];
  const lines = section.split(/\r?\n/);
  const items = [];
  let role = '';
  let quote = [];
  let acceptPlain = false;
  const flush = () => {
    if (!quote.length) return;
    const text = normalizeText(quote.join('\n'));
    if (text) items.push({ type: role || 'answer', text });
    quote = [];
    acceptPlain = false;
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\*\*.*(?:面试问题|面接質問|質問).*\*\*/.test(trimmed)) {
      flush();
      role = 'question';
      acceptPlain = true;
      continue;
    }
    if (/^\*\*.*(?:约|約)?\s*30\s*秒.*(?:回答|答え).*\*\*/.test(trimmed)) {
      flush();
      role = 'answer';
      acceptPlain = true;
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      quote.push(trimmed);
      acceptPlain = false;
      continue;
    }
    if (acceptPlain && trimmed && !/^#{1,6}\s+/.test(trimmed) && !/^\*\*/.test(trimmed)) {
      quote.push(`> ${trimmed}`);
      acceptPlain = false;
      continue;
    }
    flush();
  }
  flush();

  if (items.length) return items;
  return quoteBlocks(section).map((text) => ({ type: 'answer', text }));
};

export const parseReview = (source) => {
  const section = extractSection(source, '面试复习卡') || extractSection(source, '面接復習カード');
  if (!section) return [];
  const quoted = quoteBlocks(section);
  if (quoted.length) return quoted;

  const lines = section.split(/\r?\n/);
  const headingQuestions = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^#{3,6}\s*Q\s*\d+/i.test(lines[index].trim())) continue;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const value = lines[cursor].trim();
      if (!value) continue;
      if (/^#{1,6}\s+/.test(value)) break;
      if (/^(?:回答要点|回答ポイント|要点)\s*[：:]/.test(value.replace(/\*\*/g, ''))) break;
      if (/^\*\*/.test(value)) continue;
      if (/[ぁ-んァ-ヶ一-龠]/.test(value)) headingQuestions.push(normalizeText(value));
      break;
    }
  }
  if (headingQuestions.length) return headingQuestions;

  return lines
    .map((line) => line.trim())
    .filter((line) => /^-\s+/.test(line))
    .map((line) => line.replace(/^-\s+/, '').split(/\s*→\s*/)[0] || '')
    .map((line) => line.replace(/^`|`$/g, '').trim())
    .filter((line) => /[ぁ-んァ-ヶ一-龠]/.test(line));
};
