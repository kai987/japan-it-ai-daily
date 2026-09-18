import { test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeSiteUrl, prepareExpectedRelease, sha256, verifyPublishedRelease } from './verify-deployment.mjs';

const commit = 'a'.repeat(40), date = '2026-08-12';
const snapshot = { schemaVersion: 1, sourceCommit: commit, lastDate: date, totalDays: 1, issueNumbers: { [date]: 1 } };
const snapshotBytes = JSON.stringify(snapshot), html = '<!doctype html><html><body>Historical report</body></html>';
const expected = { version: 1, commit, date, snapshotHash: sha256(snapshotBytes), pages: [
  { path: `daily/${date}/`, sha256: sha256(html) }, { path: `ja/daily/${date}/`, sha256: sha256(html) },
] };
const response = (body, type = 'application/json', status = 200) => new Response(body, { status, headers: { 'Content-Type': type } });
const goodFetch = async (url) => url.pathname.endsWith('study-index.json') ? response(snapshotBytes) : response(html, 'text/html');
const run = (options = {}) => verifyPublishedRelease({ url: 'https://example.test/japan-it-ai-daily', expected,
  attempts: 2, delayMs: 0, log: () => {}, ...options });

test('prepares hashes from actual build output and validates its source commit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'release-verification-'));
  try {
    writeFileSync(join(dir, 'study-index.json'), snapshotBytes);
    for (const page of expected.pages) {
      mkdirSync(join(dir, page.path), { recursive: true });
      writeFileSync(join(dir, page.path, 'index.html'), html);
    }
    assert.deepEqual(prepareExpectedRelease(dir, commit), expected);
    assert.throws(() => prepareExpectedRelease(dir, 'b'.repeat(40)), /commit mismatch/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('accepts a historical report and preserves the project base path', async () => {
  const paths = [];
  const result = await run({ fetchImpl: async (url, options) => {
    paths.push(url.pathname);
    assert.ok(url.searchParams.get('verify').startsWith(commit));
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal);
    return goodFetch(url);
  } });
  assert.equal(result.date, date);
  assert.deepEqual(paths.sort(), ['/japan-it-ai-daily/study-index.json',
    `/japan-it-ai-daily/daily/${date}/`, `/japan-it-ai-daily/ja/daily/${date}/`].sort());
});

test('retries stale snapshots, then succeeds without confusing stale with published', async () => {
  let reads = 0, sleeps = 0;
  const result = await run({ sleep: async () => { sleeps += 1; }, fetchImpl: async (url) => {
    if (url.pathname.endsWith('study-index.json') && reads++ === 0) return response(JSON.stringify({ ...snapshot, sourceCommit: 'b'.repeat(40) }));
    return goodFetch(url);
  } });
  assert.equal(result.attempt, 2); assert.equal(sleeps, 1);
});

for (const [name, change, error] of [
  ['wrong date', { lastDate: '2026-08-13' }, /date mismatch/],
  ['missing issue', { issueNumbers: {} }, /valid issue/],
  ['wrong schema', { schemaVersion: 99 }, /schemaVersion/],
  ['changed bytes', { extra: 'not in build' }, /bytes differ/],
]) test(`rejects ${name}`, async () => {
  await assert.rejects(run({ attempts: 1, fetchImpl: async () => response(JSON.stringify({ ...snapshot, ...change })) }), error);
});

test('rejects stale HTML even when snapshot metadata is current', async () => {
  await assert.rejects(run({ fetchImpl: async url => url.pathname.endsWith('study-index.json')
    ? response(snapshotBytes) : response('<html>old release</html>', 'text/html') }), /HTML differs/);
});

test('rejects a missing Japanese page rather than verifying only Chinese', async () => {
  await assert.rejects(run({ fetchImpl: async url => url.pathname.includes('/ja/')
    ? response('missing', 'text/html', 404) : goodFetch(url) }), /HTTP 404/);
});

test('network failures exhaust a bounded retry budget', async () => {
  let reads = 0;
  await assert.rejects(run({ fetchImpl: async () => { reads += 1; throw new Error('offline'); } }), /after 2 attempts/);
  assert.equal(reads, 2);
});

test('invalid expected metadata fails before any network request', async () => {
  let called = false;
  await assert.rejects(run({ expected: { ...expected, pages: [] }, fetchImpl: async () => { called = true; } }), /both report routes/);
  assert.equal(called, false);
});

test('rejects unexpected response MIME and malformed JSON', async () => {
  await assert.rejects(run({ attempts: 1, fetchImpl: async () => response('<html>error</html>', 'text/html') }), /Content-Type/);
  await assert.rejects(run({ attempts: 1, fetchImpl: async () => response('{bad') }), /not verified/);
});

test('validates URL and retry parameters', async () => {
  assert.equal(normalizeSiteUrl('http://127.0.0.1:4321/base').pathname, '/base/');
  assert.throws(() => normalizeSiteUrl('http://example.test/'), /HTTPS/);
  assert.throws(() => normalizeSiteUrl('https://user:password@example.test/'), /credentials/);
  await assert.rejects(run({ attempts: 0 }), /bounded/);
  await assert.rejects(run({ attempts: 100 }), /bounded/);
});
