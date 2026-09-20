import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { versionedAudioKey } from '../src/lib/audioVersion.mjs';
import { managedMp3Key } from './audio-publication.mjs';

const MANAGED_PREFIX = 'japanese/';
const LEGACY_REVIEW_RE = /^japanese\/\d{4}-\d{2}-\d{2}\/(?:review-vocab|review-example|review-grammar-example)-\d+\.mp3$/;
const EXPLICIT_SAFE_ORPHANS = new Set([
  // Audited 2026-09-18: 2026-08-29 manifest contains only answers 01-05
  // and the repository has no reference to answer 06.
  'japanese/2026-08-29/interview-answer-06.mp3',
]);

const normalizeKey = (value) => String(value ?? '').replaceAll('\\', '/').replace(/^\/+/, '');

export function listLocalAudioKeys(root = process.cwd()) {
  const base = join(root, 'public', 'audio');
  const keys = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile()) {
        const key = normalizeKey(relative(base, full).split(sep).join('/'));
        keys.push(key);
        if (managedMp3Key(key)) {
          const hash = createHash('sha256').update(readFileSync(full)).digest('hex');
          keys.push(versionedAudioKey(key, hash));
        }
      }
    }
  };
  walk(base);
  return keys.sort();
}

export function parseRemoteObjects(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!Array.isArray(parsed)) throw new Error('Remote object list must be a JSON array.');
  return parsed.map((entry) => {
    if (typeof entry === 'string') return { key: normalizeKey(entry), size: null };
    if (!entry || typeof entry !== 'object') throw new Error('Invalid remote object entry.');
    const key = normalizeKey(entry.Key ?? entry.key);
    if (!key) throw new Error('Remote object entry is missing Key.');
    const sizeValue = entry.Size ?? entry.size;
    return { key, size: Number.isFinite(Number(sizeValue)) ? Number(sizeValue) : null };
  });
}

export function analyzeR2Orphans(localKeys, remoteObjects) {
  const local = new Set(localKeys.map(normalizeKey).filter((key) => key.startsWith(MANAGED_PREFIX)));
  const remoteManaged = remoteObjects
    .map((item) => ({ ...item, key: normalizeKey(item.key) }))
    .filter((item) => item.key.startsWith(MANAGED_PREFIX));

  const remoteMap = new Map(remoteManaged.map((item) => [item.key, item]));
  const orphaned = [...remoteMap.values()].filter((item) => !local.has(item.key)).sort((a, b) => a.key.localeCompare(b.key));
  const safeLegacy = orphaned.filter((item) => LEGACY_REVIEW_RE.test(item.key) || EXPLICIT_SAFE_ORPHANS.has(item.key));
  const otherOrphans = orphaned.filter((item) => !LEGACY_REVIEW_RE.test(item.key) && !EXPLICIT_SAFE_ORPHANS.has(item.key));
  const missingRemote = [...local]
    .filter((key) => !remoteMap.has(key))
    .sort()
    .map((key) => ({ key, size: null }));

  return {
    localManagedCount: local.size,
    remoteManagedCount: remoteManaged.length,
    orphaned,
    safeLegacy,
    otherOrphans,
    missingRemote,
    orphanedBytes: orphaned.reduce((sum, item) => sum + (item.size || 0), 0),
    safeLegacyBytes: safeLegacy.reduce((sum, item) => sum + (item.size || 0), 0),
  };
}

const bytesLabel = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
};

const argValue = (args, name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const remotePath = argValue(args, '--remote');
  const reportPath = argValue(args, '--report');
  const safeListPath = argValue(args, '--safe-list');
  const requireNoSafe = args.includes('--require-no-safe-orphans');
  const failOnMissing = args.includes('--fail-on-missing');

  if (!remotePath) throw new Error('Usage: node scripts/audit-r2-audio-orphans.mjs --remote <objects.json> [--report <report.json>] [--safe-list <keys.txt>]');

  const localKeys = listLocalAudioKeys();
  const remoteObjects = parseRemoteObjects(readFileSync(remotePath, 'utf8'));
  const result = analyzeR2Orphans(localKeys, remoteObjects);

  console.log(`R2 audio audit: local=${result.localManagedCount}, remote=${result.remoteManagedCount}, orphaned=${result.orphaned.length}, safeLegacy=${result.safeLegacy.length}, other=${result.otherOrphans.length}, missingRemote=${result.missingRemote.length}.`);
  console.log(`Orphaned size: ${bytesLabel(result.orphanedBytes)}; safe legacy size: ${bytesLabel(result.safeLegacyBytes)}.`);

  if (result.safeLegacy.length) {
    console.log('Safe legacy orphan candidates:');
    for (const item of result.safeLegacy) console.log(`  SAFE  ${item.key}  ${bytesLabel(item.size || 0)}`);
  }
  if (result.otherOrphans.length) {
    console.log('Other R2-only objects (audit only; not auto-deleted):');
    for (const item of result.otherOrphans) console.log(`  AUDIT ${item.key}  ${bytesLabel(item.size || 0)}`);
  }
  if (result.missingRemote.length) {
    console.log('Local managed files missing from R2:');
    for (const item of result.missingRemote) console.log(`  MISS  ${item.key}`);
  }

  if (reportPath) writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n');
  if (safeListPath) writeFileSync(safeListPath, result.safeLegacy.map((item) => item.key).join('\n') + (result.safeLegacy.length ? '\n' : ''));

  if (requireNoSafe && result.safeLegacy.length) throw new Error(`${result.safeLegacy.length} safe legacy R2 orphan(s) remain after prune.`);
  if (failOnMissing && result.missingRemote.length) throw new Error(`${result.missingRemote.length} local managed audio file(s) are missing from R2.`);
}
