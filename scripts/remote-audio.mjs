import { createHash } from 'node:crypto';
import { versionedAudioKey } from '../src/lib/audioVersion.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Network/authentication failures never become repair candidates. Confirm drift
// again after bounded retries before permitting an upload of that exact object.
export async function inspectRemoteAssets(assets, base, fetcher = fetch, {
  attempts = 3, delayMs = 250, timeoutMs = 30000, sleep = pause,
} = {}) {
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Audio public URL must use HTTPS without credentials, query, or fragment');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5 || !Number.isFinite(delayMs) || delayMs < 0 || delayMs > 5000
    || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new Error('Invalid bounded audio retry settings');
  const queue = [...assets.entries()];
  const issues = [];
  let verified = 0;
  let fatalError;
  await Promise.all(Array.from({ length: Math.min(8, queue.length) }, async () => {
    while (queue.length && !fatalError) {
      const [path, expected] = queue.shift();
      const target = new URL(path, url);
      const immutable = expected.sourcePath && path === versionedAudioKey(expected.sourcePath, expected.sha256);
      // Immutable playback URLs must be checked exactly as browsers request
      // them. A cache-busting query is used only for legacy mutable keys.
      if (!immutable) target.searchParams.set('v', expected.sha256);
      try {
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
          let issue;
          let retryError;
          try {
            const response = await fetcher(target, { signal: AbortSignal.timeout(timeoutMs) });
            if (response.status === 404 || response.status === 410) {
              issue = { path, kind: 'missing', message: `${path}: HTTP ${response.status}` };
              await response.body?.cancel();
            } else if (response.status === 408 || response.status === 429 || response.status >= 500) {
              retryError = new Error(`${path}: transient HTTP ${response.status}`);
              await response.body?.cancel();
            } else if (!response.ok) {
              await response.body?.cancel();
              throw Object.assign(new Error(`${path}: HTTP ${response.status}; refusing automatic repair`), { permanent: true });
            } else {
              const bytes = Buffer.from(await response.arrayBuffer());
              if (bytes.length !== expected.size || digest(bytes) !== expected.sha256) {
                issue = { path, kind: 'mismatch', message: `${path}: deployed MP3 SHA-256 mismatch` };
              } else {
                verified += 1;
                break;
              }
            }
          } catch (error) {
            if (error.permanent) throw error;
            retryError = new Error(`${path}: remote request failed (${error.message})`);
          }
          if (attempt === attempts) {
            if (retryError) throw retryError;
            issues.push(issue);
          } else await sleep(delayMs * 2 ** (attempt - 1));
        }
      } catch (error) { fatalError ||= error; }
    }
  }));
  if (fatalError) throw fatalError;
  return { verified, issues: issues.sort((a, b) => a.path.localeCompare(b.path)) };
}

export async function verifyRemoteAssets(assets, base, fetcher = fetch, options) {
  const report = await inspectRemoteAssets(assets, base, fetcher, options);
  if (report.issues.length) throw new Error(report.issues.map((issue) => issue.message).join('\n'));
  return report.verified;
}

export async function reconcileRemoteAssets(assets, base, repair, fetcher = fetch, options) {
  const report = await inspectRemoteAssets(assets, base, fetcher, options);
  // Inspection must finish successfully before ANY repair starts, even when a
  // different object was already confirmed missing before a network/auth error.
  const repaired = new Map(report.issues.map(({ path }) => [path, assets.get(path)]));
  if (repaired.size && options?.repairBatch) await options.repairBatch(repaired);
  else for (const issue of report.issues) await repair(issue.path);
  if (repaired.size) await verifyRemoteAssets(repaired, base, fetcher, options);
  return { verified: assets.size, repaired: [...repaired.keys()] };
}
