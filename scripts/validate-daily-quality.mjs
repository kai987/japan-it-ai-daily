import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const root = resolve(process.cwd());
const zhDir = join(root, 'src', 'content', 'daily');
const jaDir = join(root, 'src', 'content', 'daily-ja');
const args = new Set(process.argv.slice(2));

const fromArg = [...args].find((arg) => arg.startsWith('--from='));
const dateArg = [...args].find((arg) => arg.startsWith('--date='));
const minDate = dateArg?.slice(7) || fromArg?.slice(7) || process.env.DAILY_QUALITY_FROM || '2026-09-08';
const onlyDate = dateArg?.slice(7) || null;

const normalize = (value = '') => value.replace(/\r\n/g, '\n');
const compact = (value = '') => value.replace(/\s+/g, ' ').trim();
const stripMarkdown = (value = '') => value
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/https?:\/\/\S+/g, ' ')
  .replace(/[>*_#|]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const headingRange = (source, titleNeedle) => {
  const lines = normalize(source).split('\n');
  let start = -1;
  let depth = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;
    if (match[2].includes(titleNeedle)) {
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

const subRanges = (lines, start, end, depth = 3) => {
  const starts = [];
  const prefix = '#'.repeat(depth);
  for (let i = start + 1; i < end; i += 1) {
    if (lines[i].startsWith(`${prefix} `)) starts.push(i);
  }
  return starts.map((topicStart, index) => ({
    start: topicStart,
    end: starts[index + 1] ?? end,
    heading: lines[topicStart].replace(/^#{1,6}\s+/, '').trim(),
    body: lines.slice(topicStart + 1, starts[index + 1] ?? end).join('\n'),
  }));
};

const extractArticleSections = (source) => {
  const range = headingRange(source, '1. ');
  if (!range) return [];
  return subRanges(range.lines, range.start, range.end, 3).slice(0, 5);
};

const labelType = (line) => {
  const text = line.replace(/\s+/g, '');
  if (/^\*\*.*(?:面试问题|面試問題|面接質問|質問).*：?\*\*$/.test(text)) return 'question';
  if (/^\*\*.*(?:30秒|３０秒).*回答.*：?\*\*$/.test(text)) return 'answer';
  return null;
};

const readAfterLabel = (lines, index, end) => {
  let i = index + 1;
  while (i < end && !lines[i].trim()) i += 1;
  const values = [];
  while (i < end) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      if (values.length) break;
      i += 1;
      continue;
    }
    if (/^#{1,6}\s+/.test(trimmed) || /^\*\*/.test(trimmed)) break;
    values.push(line.replace(/^\s*>\s?/, ''));
    i += 1;
  }
  return compact(values.join(' '));
};

const extractQa = (source) => {
  const range = headingRange(source, '面接で使えるポイント');
  if (!range) return [];
  return subRanges(range.lines, range.start, range.end, 3).map((topic) => {
    let question = '';
    let answer = '';
    for (let i = topic.start + 1; i < topic.end; i += 1) {
      const type = labelType(range.lines[i]);
      if (type === 'question') question = readAfterLabel(range.lines, i, topic.end);
      if (type === 'answer') answer = readAfterLabel(range.lines, i, topic.end);
    }
    return { heading: topic.heading, question, answer };
  });
};

const genericTokens = new Set([
  '重要', '確認', '評価', '必要', '場合', '利用', '導入', '運用', '本番', '実際', '実装', '設計', '改善', '対応',
  '技術', '機能', '方法', '結果', '品質', '企業', 'システム', 'サービス', 'データ', 'モデル', 'コスト', '性能',
  '情報', '記事', '今回', '同じ', '考え', '判断', '検証', '比較', '可能', '継続', '段階', '環境', '内容', '処理',
  'AI', 'System', 'Model', 'Data', 'Quality', 'Cost', 'Latency', 'Workload', 'PoC', 'Token', 'Request', 'Dashboard',
]);

const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
const wordTokens = (text) => {
  const cleaned = stripMarkdown(text);
  const tokens = new Set();
  for (const part of segmenter.segment(cleaned)) {
    const token = part.segment.trim();
    if (!part.isWordLike || token.length < 2) continue;
    if (genericTokens.has(token)) continue;
    if (/^[ぁ-ん]{1,3}$/.test(token)) continue;
    if (/^[0-9]+$/.test(token)) continue;
    tokens.add(token);
  }
  for (const match of cleaned.matchAll(/\b[A-Za-z][A-Za-z0-9_.+/-]{2,}\b/g)) {
    if (!genericTokens.has(match[0])) tokens.add(match[0]);
  }
  for (const match of cleaned.matchAll(/\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?(?:MB|GB|ms|秒|件|問|倍|個|本|ファイル|Task|Token)\b/g)) {
    tokens.add(match[0]);
  }
  return tokens;
};

const uniqueArticleAnchors = (articles) => {
  const sets = articles.map((article) => wordTokens(`${article.heading}\n${article.body}`));
  const df = new Map();
  sets.forEach((set) => set.forEach((token) => df.set(token, (df.get(token) || 0) + 1)));
  return sets.map((set) => new Set([...set].filter((token) => df.get(token) === 1)));
};

const answerAnchorMatches = (answer, anchors) => {
  const answerText = stripMarkdown(answer);
  return [...anchors].filter((token) => answerText.includes(token));
};

const evidencePattern = /(\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?(?:MB|GB|ms|秒|件|問|倍|個|本|ファイル|Task|Token)|実測|測定|比較|調査|Benchmark|ベンチマーク|検証|原文|発表|報告)/i;
const limitationPattern = /(ただし|一方で|制約|限界|注意|保証|とは限ら|未対応|未提供|Alpha|アルファ|参考値|単発|一度|一回|条件|依存|課題|反例|追加確認|一般化|本番|実Workload|実Application)/i;

const sentenceList = (answer) => compact(answer)
  .split(/(?<=[。！？])/)
  .map((sentence) => sentence.trim())
  .filter((sentence) => sentence.length >= 16);

const tokenJaccard = (a, b) => {
  const aSet = wordTokens(a);
  const bSet = wordTokens(b);
  const union = new Set([...aSet, ...bSet]);
  if (!union.size) return 0;
  let intersection = 0;
  aSet.forEach((token) => { if (bSet.has(token)) intersection += 1; });
  return intersection / union.size;
};

const articleCharCount = (article) => stripMarkdown(article.body).replace(/\s/g, '').length;
const paragraphCount = (article) => normalize(article.body)
  .split(/\n\s*\n/)
  .map((part) => stripMarkdown(part))
  .filter((part) => part.length >= 40).length;

const validateReport = (date, zhSource, jaSource) => {
  const errors = [];
  const warnings = [];
  const zhArticles = extractArticleSections(zhSource);
  const jaArticles = extractArticleSections(jaSource);
  const zhQa = extractQa(zhSource);
  const jaQa = extractQa(jaSource);

  if (zhArticles.length !== 5) errors.push(`中文 Top 5 详细解说应为 5 篇，实际 ${zhArticles.length}`);
  if (jaArticles.length !== 5) errors.push(`日语 Top 5 详细解说应为 5 篇，实际 ${jaArticles.length}`);
  if (zhQa.length !== 5) errors.push(`中文模式 Section 3 应为 5 组 Q&A，实际 ${zhQa.length}`);
  if (jaQa.length !== 5) errors.push(`日语模式 Section 3 应为 5 组 Q&A，实际 ${jaQa.length}`);

  for (const [language, articles] of [['中文', zhArticles], ['日语', jaArticles]]) {
    articles.forEach((article, index) => {
      const chars = articleCharCount(article);
      const paragraphs = paragraphCount(article);
      if (chars < 430) errors.push(`${language} Top ${index + 1} 解说过短：${chars} 字符，至少需要 430 个非空白字符`);
      if (paragraphs < 2) errors.push(`${language} Top ${index + 1} 至少需要 2 个实质段落，实际 ${paragraphs}`);
      const plain = stripMarkdown(article.body);
      if (!evidencePattern.test(plain)) warnings.push(`${language} Top ${index + 1} 未发现明确证据/测量/比较提示，请人工确认是否说明了证据边界`);
      if (!limitationPattern.test(plain)) errors.push(`${language} Top ${index + 1} 未发现限制、适用条件或证据边界说明`);
    });
  }

  const anchors = uniqueArticleAnchors(zhArticles);
  zhQa.forEach((qa, index) => {
    const answerChars = qa.answer.replace(/\s/g, '').length;
    if (!qa.question) errors.push(`Q&A ${index + 1} 缺少質問`);
    if (!qa.answer) errors.push(`Q&A ${index + 1} 缺少30秒回答`);
    if (answerChars < 90 || answerChars > 260) {
      errors.push(`Q&A ${index + 1} 回答长度 ${answerChars} 字符，不符合 30 秒目标范围 90–260`);
    }
    const matches = answerAnchorMatches(qa.answer, anchors[index] || new Set());
    if (matches.length < 2) {
      errors.push(`Q&A ${index + 1} 与对应文章共享的独有技术锚点不足 2 个；检测到：${matches.join(', ') || '无'}`);
    }
    const articlePlain = stripMarkdown(zhArticles[index]?.body || '');
    if (limitationPattern.test(articlePlain) && !limitationPattern.test(qa.answer)) {
      errors.push(`Q&A ${index + 1} 对应文章存在限制/边界，但回答未体现任何限制或验证条件`);
    }
  });

  const sentenceOwners = new Map();
  zhQa.forEach((qa, index) => {
    sentenceList(qa.answer).forEach((sentence) => {
      const key = sentence.replace(/\s+/g, '');
      const owners = sentenceOwners.get(key) || [];
      owners.push(index + 1);
      sentenceOwners.set(key, owners);
    });
  });
  for (const [sentence, owners] of sentenceOwners.entries()) {
    if (owners.length >= 2) errors.push(`Q&A 模板句重复于 ${owners.join(', ')}：${sentence}`);
  }

  for (let i = 0; i < zhQa.length; i += 1) {
    for (let j = i + 1; j < zhQa.length; j += 1) {
      const similarity = tokenJaccard(zhQa[i].answer, zhQa[j].answer);
      if (similarity >= 0.68) {
        errors.push(`Q&A ${i + 1} 与 ${j + 1} 词汇相似度过高：${similarity.toFixed(2)}，疑似模板化`);
      }
    }
  }

  return { date, errors, warnings };
};

const dates = readdirSync(zhDir)
  .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
  .map((name) => basename(name, '.md'))
  .filter((date) => date >= minDate)
  .filter((date) => !onlyDate || date === onlyDate)
  .sort();

if (!dates.length) {
  console.log(`Daily quality gate: no report dates to validate (from ${minDate}).`);
  process.exit(0);
}

let failed = false;
for (const date of dates) {
  const zhPath = join(zhDir, `${date}.md`);
  const jaPath = join(jaDir, `${date}.md`);
  if (!existsSync(jaPath)) {
    console.error(`\n${date}\n  ERROR: missing Japanese report ${jaPath}`);
    failed = true;
    continue;
  }
  const result = validateReport(date, readFileSync(zhPath, 'utf8'), readFileSync(jaPath, 'utf8'));
  console.log(`\n${date}: ${result.errors.length ? 'FAIL' : 'PASS'}`);
  result.warnings.forEach((warning) => console.warn(`  WARN: ${warning}`));
  result.errors.forEach((error) => console.error(`  ERROR: ${error}`));
  if (result.errors.length) failed = true;
}

if (failed) process.exit(1);
console.log('\nDaily quality gate passed.');
