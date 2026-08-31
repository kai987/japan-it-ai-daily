export type SearchKind = 'report' | 'article';

export interface SearchItem {
  id: string;
  kind: SearchKind;
  title: string;
  source: string;
  topic: string;
  why: string;
  date: string;
  href: string;
  external: boolean;
  reportTitle: string;
  reportDescription: string;
  reportTopics: string[];
  segments: string[];
}

export interface SearchResult extends SearchItem {
  matchSnippet: string;
}

export const cleanSearchSegment = (value: string): string => value
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/^>\s?/gm, '')
  .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
  .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/https?:\/\/\S+/g, '')
  .replace(/[*_`~]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

export const reportSegments = (value: unknown): string[] => String(value ?? '')
  .split(/\n{2,}/)
  .map(cleanSearchSegment)
  .filter((segment) => segment.length >= 2);

export const normalizeSearchText = (value: unknown): string => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase('ja-JP')
  .replace(/\s+/g, ' ')
  .trim();

export const compactSearchText = (value: unknown): string => normalizeSearchText(value)
  .replace(/[\s\p{P}\p{S}]+/gu, '');

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current: number[] = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + cost,
      );
    }
    previous = current;
  }
  return previous[b.length]!;
};

const editSimilarity = (query: string, text: string): number => {
  if (query.length < 3 || text.length < 3) return 0;
  const queryLength = query.length;
  if (text.length <= queryLength + 2) {
    return 1 - levenshtein(query, text) / Math.max(queryLength, text.length);
  }

  let best = 0;
  const lengths = [Math.max(2, queryLength - 1), queryLength, queryLength + 1];
  for (const length of lengths) {
    for (let start = 0; start <= text.length - length; start += 1) {
      const sample = text.slice(start, start + length);
      const similarity = 1 - levenshtein(query, sample) / Math.max(queryLength, sample.length);
      if (similarity > best) best = similarity;
      if (best >= 0.92) return best;
    }
  }
  return best;
};

const subsequenceScore = (query: string, text: string): number => {
  let cursor = 0;
  let first = -1;
  let last = -1;

  for (const char of query) {
    const found = text.indexOf(char, cursor);
    if (found < 0) return 0;
    if (first < 0) first = found;
    last = found;
    cursor = found + 1;
  }

  const span = last - first + 1;
  const extra = Math.max(0, span - query.length);
  const startPenalty = Math.min(first, 20) * 0.008;
  const gapPenalty = Math.min(extra, 20) * 0.018;
  return Math.max(0, 0.72 - startPenalty - gapPenalty);
};

export const fieldScore = (query: string, text: unknown): number => {
  const normalizedQuery = compactSearchText(query);
  const normalizedText = compactSearchText(text);
  if (!normalizedQuery || !normalizedText) return 0;
  if (normalizedQuery === normalizedText) return 1;

  const found = normalizedText.indexOf(normalizedQuery);
  if (found >= 0) return Math.max(0.78, 0.97 - Math.min(found, 40) * 0.006);

  const subsequence = subsequenceScore(normalizedQuery, normalizedText);
  const edit = editSimilarity(normalizedQuery, normalizedText);
  const typoScore = edit >= 0.62 ? edit * 0.82 : 0;
  return Math.max(subsequence, typoScore);
};

export const matchingSegment = (item: SearchItem, query: string): string => {
  if (item.kind !== 'report') return '';
  const normalizedQuery = compactSearchText(query);
  if (!normalizedQuery) return '';
  return item.segments.find((segment) => compactSearchText(segment).includes(normalizedQuery)) ?? '';
};

const itemScore = (item: SearchItem, query: string, segment: string): number => {
  const fields: Array<[string, number]> = item.kind === 'report'
    ? [
        [item.title, 3.6],
        [item.reportDescription, 1.1],
        [item.reportTopics.join(' '), 1.2],
      ]
    : [
        [item.title, 5],
        [item.topic, 2.2],
        [item.source, 1.5],
        [item.why, 1.15],
        [item.reportTitle, 0.65],
        [item.reportDescription, 0.55],
        [item.reportTopics.join(' '), 0.9],
      ];

  const metadataScore = fields.reduce(
    (total, [value, weight]) => total + fieldScore(query, value) * weight,
    0,
  );
  return metadataScore + (item.kind === 'report' && segment ? 3.4 : 0);
};

export const makeSearchSnippet = (segment: string, query: string): string => {
  const text = String(segment || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  const lowerText = text.toLocaleLowerCase('ja-JP');
  const lowerQuery = String(query || '').toLocaleLowerCase('ja-JP');
  const hit = lowerText.indexOf(lowerQuery);
  if (hit < 0) return text.length > 150 ? `${text.slice(0, 147)}…` : text;

  const before = 48;
  const after = 86;
  const start = Math.max(0, hit - before);
  const end = Math.min(text.length, hit + lowerQuery.length + after);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
};

export const searchItems = (
  items: readonly SearchItem[],
  query: string,
  limit = 8,
): SearchResult[] => {
  const normalized = normalizeSearchText(query);
  if (!normalized) {
    return items
      .filter((item) => item.kind === 'article')
      .slice(0, 6)
      .map((item) => ({ ...item, matchSnippet: '' }));
  }

  return items
    .map((item) => {
      const segment = matchingSegment(item, normalized);
      return { item, segment, score: itemScore(item, normalized, segment) };
    })
    .filter(({ score }) => score >= 0.72)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff) return scoreDiff;

      const dateDiff = b.item.date.localeCompare(a.item.date);
      if (dateDiff) return dateDiff;

      if (a.item.kind === b.item.kind) return 0;
      return a.item.kind === 'article' ? -1 : 1;
    })
    .slice(0, limit)
    .map(({ item, segment }) => ({
      ...item,
      matchSnippet: makeSearchSnippet(segment, query),
    }));
};
