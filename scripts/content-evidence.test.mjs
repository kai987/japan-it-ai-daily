import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test, expect } from 'vitest';
import { contentDirs, readContent } from './content-files.mjs';
import { validateContentDay } from './validate-content-integrity.mjs';
import { createEvidenceDraft, validateEvidence, sha256 } from './source-evidence.mjs';
const date = '2026-09-07';
const documents = () => Object.fromEntries(contentDirs.map((dir) => [dir, readContent(process.cwd(), dir, date).data]));

test('accepted reference and independent localized display titles pass content integrity', () => {
  const docs = documents();
  docs['daily-ja'].top[0].title = '独立した日本語見出し';
  expect(validateContentDay(date, docs)).toEqual([]);
});
for (const [name, mutate, error] of [
  ['top count', (docs) => docs.daily.top.pop(), 'exactly five'],
  ['top order', (docs) => docs['daily-ja'].top.reverse(), 'identity/order'],
  ['declared counts', (docs) => docs.japanese.vocabularyCount++, 'vocabularyCount'],
  ['missing must-remember', (docs) => docs.japanese.mustRememberWords[0] = '存在しない語', 'unknown item'],
  ['level mismatch', (docs) => docs['japanese-ja'].vocabulary[0].level = 'N5/N4', 'identity/order'],
  ['file date mismatch', (docs) => docs.daily.date = '2026-09-08', 'date differs'],
  ['missing language', (docs) => delete docs['japanese-ja'], 'missing'],
]) test(`content gate rejects ${name}`, () => {
  const docs = documents(); mutate(docs);
  expect(validateContentDay(date, docs).join('\n')).toContain(error);
});

const pilot = () => JSON.parse(readFileSync('docs/evidence/pilot-2026-09-07.json', 'utf8'));
const check = (record, sourceDir) => validateEvidence(record, date, readContent(process.cwd(), 'daily', date), readContent(process.cwd(), 'daily-ja', date), sourceDir);
test('new dated reports cannot pass CI without evidence, and draft creation never overwrites review', () => {
  const root = mkdtempSync(join(tmpdir(), 'evidence-cli-'));
  const script = (name) => join(process.cwd(), 'scripts', name);
  try {
    for (const dir of contentDirs) {
      mkdirSync(join(root, 'src/content', dir), { recursive: true });
      writeFileSync(join(root, 'src/content', dir, '2026-09-08.md'), '---\ndate: 2026-09-08\n---\n');
    }
    const missing = spawnSync(process.execPath, [script('validate-source-evidence.mjs')], { cwd: root, encoding: 'utf8' });
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('2026-09-08.json');
    const context = join(root, 'context.json'), output = join(root, 'draft.json');
    writeFileSync(context, JSON.stringify({ date, top: documents().daily.top, body: 'CHINESE_PROSE_MUST_NOT_BE_COPIED' }));
    const args = [script('init-source-evidence.mjs'), '--date', date, '--context', context, '--output', output];
    execFileSync(process.execPath, args);
    const draft = readFileSync(output, 'utf8');
    expect(draft).not.toContain('CHINESE_PROSE_MUST_NOT_BE_COPIED');
    expect(JSON.parse(draft).status).toBe('draft');
    expect(spawnSync(process.execPath, args).status).not.toBe(0);
    expect(readFileSync(output, 'utf8')).toBe(draft);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('source pilot passes offline structural checks but a scaffold never self-approves', () => {
  expect(check(pilot())).toEqual([]);
  expect(check(createEvidenceDraft(date, documents().daily.top)).join('\n')).toContain('not reviewed');
});
for (const [name, mutate, error] of [
  ['wrong source', (r) => r.articles[0].url = 'https://example.com/wrong', 'url mismatch'],
  ['missing quote', (r) => r.articles[0].claims[0].quote = '', 'short original quote'],
  ['stale citation', (r) => r.articles[0].claims[0].usedIn.ja = '日報にはない論断', 'no longer matches'],
  ['unavailable source', (r) => r.articles[0].access = 'unavailable', 'source unavailable'],
  ['unbound inference', (r) => { r.articles[0].claims[0].kind = 'author-interpretation'; }, 'source-fact references'],
]) test(`evidence gate rejects ${name}`, () => { const record = pilot(); mutate(record); expect(check(record).join('\n')).toContain(error); });
test('snapshot verification detects both changed bytes and fabricated quotations', () => {
  const root = mkdtempSync(join(tmpdir(), 'evidence-snapshot-'));
  const record = pilot();
  try {
    record.articles.forEach((a, i) => { const source = `URL: ${a.url}\n\n${a.claims[0].quote}`; writeFileSync(join(root, `0${i + 1}.txt`), source); a.snapshotSha256 = sha256(source); });
    expect(check(record, root)).toEqual([]);
    record.articles[0].claims[0].quote = '原文にない引用';
    expect(check(record, root).join('\n')).toContain('quote is absent');
    writeFileSync(join(root, '02.txt'), 'Changed snapshot');
    expect(check(record, root).join('\n')).toContain('snapshot changed');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
