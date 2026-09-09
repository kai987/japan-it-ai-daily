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
  const flush = () => {
    if (!quote.length) return;
    const text = normalizeText(quote.join('\n'));
    if (text) items.push({ type: role || 'answer', text });
    quote = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\*\*.*面试问题.*\*\*/.test(trimmed)) {
      flush();
      role = 'question';
      continue;
    }
    if (/^\*\*.*(?:约|約)?\s*30\s*秒.*(?:回答|答え).*\*\*/.test(trimmed)) {
      flush();
      role = 'answer';
      continue;
    }
    if (/^>\s?/.test(trimmed)) quote.push(trimmed);
    else flush();
  }
  flush();

  if (items.length) return items;
  return quoteBlocks(section).map((text) => ({ type: 'answer', text }));
};

export const parseReview = (source) => {
  const section = extractSection(source, '面试复习卡');
  if (!section) return [];
  const quoted = quoteBlocks(section);
  if (quoted.length) return quoted;

  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^-\s+/.test(line))
    .map((line) => line.replace(/^-\s+/, '').split(/\s*→\s*/)[0] || '')
    .map((line) => line.replace(/^`|`$/g, '').trim())
    .filter((line) => /[ぁ-んァ-ヶ一-龠]/.test(line));
};

