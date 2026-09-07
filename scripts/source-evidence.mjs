import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const EVIDENCE_FROM = '2026-09-08';
export const sha256 = (text) => createHash('sha256').update(text).digest('hex');
export const normalizeEvidenceText = (text = '') => text.normalize('NFKC').replace(/[*`_]/g, '').replace(/\s+/g, ' ').trim();
export const numberedSection = (body, number) => body.match(new RegExp(`^## ${number}\\.[^\\n]*\\n([\\s\\S]*?)(?=^#{1,2} |(?![\\s\\S]))`, 'm'))?.[1] ?? '';
export const articleParts = (body, section = 1) => numberedSection(body, section).split(/^### .+$/m).slice(1);

export const createEvidenceDraft = (date, top) => ({
  schemaVersion: 1,
  date,
  status: 'draft',
  reviewedBy: '',
  reviewedAt: '',
  scope: 'Declared source claims only; not automatic verification of every sentence.',
  articles: top.map((item, index) => ({
    articleId: `${date}-top-${index + 1}`,
    url: item.url,
    originalTitle: item.title,
    source: item.source,
    topic: item.topic,
    access: 'unreviewed',
    accessNote: '',
    capturedAt: '',
    snapshotSha256: '',
    claims: [],
  })),
});

export const validateEvidence = (record, date, zh, ja, sourceDir) => {
  const errors = [];
  const require = (ok, text) => { if (!ok) errors.push(`${date}: ${text}`); };
  const text = (value) => typeof value === 'string' && value.trim().length > 0;
  const timestamp = (value) => text(value) && Number.isFinite(Date.parse(value));
  require(record.schemaVersion === 1 && record.date === date, 'evidence schema/date mismatch');
  require(record.status === 'reviewed' && text(record.reviewedBy) && timestamp(record.reviewedAt), 'evidence is not reviewed');
  require(text(record.scope), 'review scope missing');
  const articles = Array.isArray(record.articles) ? record.articles : [];
  require(articles.length === 5, 'five evidence articles required');
  const zhParts = articleParts(zh.body), jaParts = articleParts(ja.body), qaParts = articleParts(zh.body, 3);
  articles.forEach((article, index) => {
    const label = `Top ${index + 1}`;
    const expected = zh.data.top[index];
    require(article.articleId === `${date}-top-${index + 1}`, `${label} stable articleId/order mismatch`);
    for (const key of ['url', 'source', 'topic']) require(article[key] === expected?.[key] && article[key] === ja.data.top[index]?.[key], `${label} ${key} mismatch`);
    require(text(article.originalTitle), `${label} original title missing`);
    require(['full', 'public-portion'].includes(article.access), `${label} source unavailable or unreviewed`);
    require(text(article.accessNote), `${label} access scope missing`);
    require(timestamp(article.capturedAt) && /^[a-f0-9]{64}$/.test(article.snapshotSha256 || ''), `${label} source capture metadata missing`);
    let original;
    if (sourceDir) {
      try {
        original = readFileSync(join(sourceDir, `${String(index + 1).padStart(2, '0')}.txt`), 'utf8');
        require(sha256(original) === article.snapshotSha256, `${label} source snapshot changed`);
        require(!original.includes('FETCH_STATUS: failed'), `${label} source fetch failed`);
      } catch { require(false, `${label} source snapshot missing`); }
    }
    const claims = Array.isArray(article.claims) ? article.claims : [];
    require(claims.some((claim) => claim.kind === 'source-fact'), `${label} source fact missing`);
    require(new Set(claims.map((claim) => claim.id)).size === claims.length, `${label} duplicate claim ID`);
    const covered = new Set();
    claims.forEach((claim) => {
      require(text(claim.id) && text(claim.statement) && text(claim.conditions), `${label} claim/conditions missing`);
      require(['source-fact', 'author-interpretation', 'teaching-example'].includes(claim.kind), `${label} invalid claim kind`);
      if (claim.kind === 'source-fact') {
        require(text(claim.quote) && text(claim.locator), `${label} source fact needs a short original quote and locator`);
        if (original && text(claim.quote)) require(normalizeEvidenceText(original).includes(normalizeEvidenceText(claim.quote)), `${label} quote is absent from captured source`);
      } else {
        require(Array.isArray(claim.basedOn) && claim.basedOn.length > 0 && claim.basedOn.every((id) => claims.some((item) => item.id === id && item.kind === 'source-fact')), `${label} interpretation/example needs source-fact references`);
      }
      for (const [target, body] of [['zh', zhParts[index]], ['ja', jaParts[index]], ['interview', qaParts[index]]]) {
        const reference = claim.usedIn?.[target];
        if (text(reference)) {
          covered.add(target);
          require(normalizeEvidenceText(body || '').includes(normalizeEvidenceText(reference)), `${label} ${target} citation no longer matches content`);
        }
      }
    });
    for (const target of ['zh', 'ja', 'interview']) require(covered.has(target), `${label} ${target} has no declared evidence mapping`);
  });
  return errors;
};
