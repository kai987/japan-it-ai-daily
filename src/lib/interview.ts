const stripInlineMarkdown = (value: string) => value
  .replace(/\*\*/g, '')
  .replace(/__/g, '')
  .replace(/^`|`$/g, '')
  .trim();

/**
 * Extract a Markdown section while preserving nested headings.
 *
 * Legacy reports use `### 面接で使えるポイント`, while newer reports use
 * `## 3. 面接で使えるポイント` with several `### 话题 ...` children.
 * The old regex stopped at every h2/h3, which discarded all nested content.
 */
const extractSection = (body: string, title: string) => {
  const lines = body.split(/\r?\n/);
  const needle = title.replace(/\s+/g, '').toLocaleLowerCase('ja-JP');
  let start = -1;
  let sectionDepth = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!match) continue;
    const headingText = match[2]
      .replace(/^\d+[.．、)]\s*/, '')
      .replace(/\s+/g, '')
      .toLocaleLowerCase('ja-JP');
    if (!headingText.includes(needle)) continue;
    start = index + 1;
    sectionDepth = match[1].length;
    break;
  }

  if (start < 0) return '';

  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    const match = lines[index].match(/^(#{1,6})\s+/);
    if (match && match[1].length <= sectionDepth) {
      end = index;
      break;
    }
  }

  return lines.slice(start, end).join('\n').trim();
};

/**
 * Read the answer/question paragraph following a labelled line.
 *
 * Historical content uses Markdown blockquotes. New source-of-truth reports may
 * keep the canonical interview string as a plain paragraph so it can be copied
 * byte-for-byte between language modes. Support both without changing the
 * extracted string.
 */
const collectTextAfter = (lines: string[], labelIndex: number) => {
  const values: string[] = [];
  let started = false;
  let quoted = false;

  for (let index = labelIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line && !started) continue;
    if (!line && started) break;
    if (/^(#{1,6})\s+/.test(line) || /^\*\*.+\*\*/.test(line)) break;

    if (line.startsWith('>')) {
      if (started && !quoted) break;
      started = true;
      quoted = true;
      const text = line.replace(/^>\s?/, '').trim();
      if (text) values.push(text);
      continue;
    }

    if (quoted) break;
    started = true;
    values.push(line);
  }

  return values.join(' ').trim();
};

export const extractAnswers = (body: string) => {
  const section = extractSection(body, '面接で使えるポイント');
  if (!section) return [];
  const lines = section.split(/\r?\n/);
  const answers: string[] = [];

  // New format (2026-08-27+): each topic contains a labelled 30-second answer.
  lines.forEach((line, index) => {
    const label = stripInlineMarkdown(line).replace(/[：:]$/, '');
    if (!/^(?:約|约)?\s*30\s*秒.*(?:回答|答え)/i.test(label.normalize('NFKC'))) return;
    const answer = collectTextAfter(lines, index);
    if (answer) answers.push(answer);
  });

  if (answers.length) return Array.from(new Set(answers));

  // Legacy format: the interview section consists directly of answer quotes.
  return Array.from(new Set(
    lines
      .map((line) => line.trim())
      .filter((line) => line.startsWith('>'))
      .map((line) => line.replace(/^>\s*/, '').trim())
      .filter(Boolean)
  ));
};

const cleanReviewPoints = (value: string) => stripInlineMarkdown(value)
  .replace(/^(?:回答要点|回答ポイント|要点)\s*[：:]\s*/, '')
  .trim();

export const extractReviewCards = (body: string) => {
  const section = extractSection(body, '面试复习卡') || extractSection(body, '面接復習カード');
  if (!section) return [];
  const lines = section.split(/\r?\n/);
  const cards: Array<{ question: string; points: string }> = [];

  // New format: ### Q1 -> quoted or plain question -> 回答要点：...
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^#{3,6}\s*Q\s*\d+/i.test(lines[index].trim())) continue;
    let end = lines.length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^#{3,6}\s*Q\s*\d+/i.test(lines[cursor].trim())) {
        end = cursor;
        break;
      }
    }

    const block = lines.slice(index + 1, end);
    const quotedQuestion = block
      .map((line) => line.trim())
      .find((line) => line.startsWith('>'))
      ?.replace(/^>\s*/, '')
      .trim() ?? '';
    const plainQuestion = block
      .map((line) => line.trim())
      .find((line) => line && !/^\*\*/.test(line) && !/^(?:回答要点|回答ポイント|要点)\s*[：:]/.test(stripInlineMarkdown(line))) ?? '';
    const question = quotedQuestion || stripInlineMarkdown(plainQuestion);
    const pointsLine = block
      .map((line) => line.trim())
      .find((line) => /^(?:回答要点|回答ポイント|要点)\s*[：:]/.test(stripInlineMarkdown(line)));
    const points = pointsLine ? cleanReviewPoints(pointsLine) : '';

    if (question) cards.push({ question, points });
    index = end - 1;
  }

  if (cards.length) return cards;

  // Legacy format: - 質問 → 要点
  return lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .map((line) => {
      const clean = line.replace(/^-\s*/, '');
      const parts = clean.split(/\s*→\s*/);
      return {
        question: stripInlineMarkdown(parts[0] ?? ''),
        points: stripInlineMarkdown(parts.slice(1).join(' → ') ?? ''),
      };
    })
    .filter((item) => item.question);
};
