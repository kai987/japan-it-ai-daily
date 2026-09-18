import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const commitPattern = /^[a-f0-9]{40}$/;
const validDate = (date) => typeof date === 'string' && datePattern.test(date)
  && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

export function validateExpectedRelease(expected) {
  if (!expected || expected.version !== 1 || !commitPattern.test(expected.commit || '')
    || !validDate(expected.date) || !hashPattern.test(expected.snapshotHash || '')) {
    throw new Error('Invalid expected release: version, full commit, date and snapshot hash are required');
  }
  const paths = [`daily/${expected.date}/`, `ja/daily/${expected.date}/`];
  if (!Array.isArray(expected.pages) || expected.pages.length !== paths.length
    || expected.pages.some((page, i) => page?.path !== paths[i] || !hashPattern.test(page?.sha256 || ''))) {
    throw new Error('Expected release must contain hashes for both report routes in zh/ja order');
  }
  return expected;
}

function validateSnapshot(snapshot, commit, date) {
  if (snapshot?.schemaVersion !== 1) throw new Error('Unsupported study-index schemaVersion');
  if (snapshot.sourceCommit !== commit) throw new Error(`Snapshot commit mismatch: ${snapshot.sourceCommit || '(empty)'}`);
  if (!validDate(snapshot.lastDate) || snapshot.lastDate !== date) throw new Error(`Snapshot date mismatch: ${snapshot.lastDate}`);
  if (!Number.isInteger(snapshot.totalDays) || snapshot.totalDays < 1
    || !Number.isInteger(snapshot.issueNumbers?.[date]) || snapshot.issueNumbers[date] < 1) {
    throw new Error(`Snapshot does not contain a valid issue for ${date}`);
  }
}

// Build expectations from the artifact being deployed, NEVER from today's clock.
// The existing study-index remains the only public learning snapshot.
export function prepareExpectedRelease(dist, commit) {
  if (!commitPattern.test(commit || '')) throw new Error('A full GITHUB_SHA or --commit is required');
  const bytes = readFileSync(join(dist, 'study-index.json'));
  const snapshot = JSON.parse(bytes.toString('utf8'));
  validateSnapshot(snapshot, commit, snapshot.lastDate);
  const date = snapshot.lastDate;
  return validateExpectedRelease({
    version: 1, commit, date, snapshotHash: sha256(bytes),
    pages: [`daily/${date}/`, `ja/daily/${date}/`].map((path) => {
      const html = readFileSync(join(dist, path, 'index.html'));
      if (!/<html\b/i.test(html.toString('utf8'))) throw new Error(`Not an HTML page: ${path}`);
      return { path, sha256: sha256(html) };
    }),
  });
}

export function normalizeSiteUrl(value) {
  const url = new URL(value);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new Error('Site URL must use HTTPS (HTTP is allowed only for loopback tests) and contain no credentials');
  }
  url.search = ''; url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

export async function verifyPublishedRelease({
  url, expected, attempts = 8, delayMs = 10000, timeoutMs = 10000,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  log = console.log,
}) {
  validateExpectedRelease(expected);
  const base = normalizeSiteUrl(url);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 12
    || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > 30000
    || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    throw new Error('Invalid bounded retry/timeout settings');
  }
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const read = async (path, contentType) => {
      const target = new URL(path, base);
      target.searchParams.set('verify', `${expected.commit}-${attempt}-${Date.now()}`);
      const response = await fetchImpl(target, {
        cache: 'no-store', headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      if (!(response.headers.get('content-type') || '').toLowerCase().includes(contentType)) {
        throw new Error(`${path}: unexpected Content-Type`);
      }
      return Buffer.from(await response.arrayBuffer());
    };
    try {
      const bytes = await read('study-index.json', 'application/json');
      validateSnapshot(JSON.parse(bytes.toString('utf8')), expected.commit, expected.date);
      if (sha256(bytes) !== expected.snapshotHash) throw new Error('Snapshot bytes differ from the built artifact');
      await Promise.all(expected.pages.map(async (page) => {
        const html = await read(page.path, 'text/html');
        if (!/<html\b/i.test(html.toString('utf8')) || sha256(html) !== page.sha256) {
          throw new Error(`${page.path}: HTML differs from the built artifact`);
        }
      }));
      log(`Published release verified: ${expected.commit} / ${expected.date}; snapshot and both report hashes match (attempt ${attempt}/${attempts}).`);
      return { commit: expected.commit, date: expected.date, attempt };
    } catch (error) {
      lastError = error;
      log(`Publication verification ${attempt}/${attempts}: ${error.message}`);
      if (attempt < attempts) await sleep(delayMs);
    }
  }
  throw new Error(`Published release not verified after ${attempts} attempts: ${lastError?.message}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const value = (name) => {
      const index = args.indexOf(name);
      return index < 0 ? undefined : args[index + 1];
    };
    if (args.includes('--prepare')) {
      if (!value('--prepare')) throw new Error('--prepare requires a dist directory');
      console.log(JSON.stringify(prepareExpectedRelease(value('--prepare'), value('--commit') || process.env.GITHUB_SHA)));
    } else {
      if (!value('--url') || !value('--expected')) throw new Error('Usage: --url SITE --expected EXPECTED_RELEASE_JSON');
      await verifyPublishedRelease({ url: value('--url'), expected: JSON.parse(value('--expected')) });
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
