import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { versionedAudioKey } from '../src/lib/audioVersion.mjs';

export const managedMp3Key = (key) => /^japanese\/\d{4}-\d{2}-\d{2}\/[\w-]+\.mp3$/.test(key);
const managedFileKey = (key) => /^japanese\/\d{4}-\d{2}-\d{2}\/[\w-]+\.(?:mp3|json)$/.test(key);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function immutableAudioAssets(assets, includeLegacy = false) {
  const result = new Map();
  for (const [path, expected] of assets) {
    const sourcePath = expected.sourcePath || path;
    if (!managedMp3Key(sourcePath)) throw new Error(`Invalid local audio source: ${sourcePath}`);
    const value = { ...expected, sourcePath };
    if (includeLegacy) result.set(sourcePath, value);
    result.set(versionedAudioKey(sourcePath, expected.sha256), value);
  }
  return result;
}

// Only a temporary staging tree receives the hash names. Tracked files keep
// their legacy names, and old pages keep working through those original keys.
export function stageAudioAssets(assets, staging, root = process.cwd()) {
  for (const [key, expected] of assets) {
    const sourcePath = expected.sourcePath || key;
    if (!managedMp3Key(key) || !managedMp3Key(sourcePath)
      || (key !== sourcePath && key !== versionedAudioKey(sourcePath, expected.sha256))) throw new Error('Invalid staged audio mapping');
    const source = join(root, 'public/audio', sourcePath);
    const bytes = readFileSync(source);
    if (bytes.length !== expected.size || digest(bytes) !== expected.sha256) throw new Error(`${sourcePath}: audio changed after verification`);
    const target = join(staging, key);
    mkdirSync(dirname(target), { recursive: true });
    // Stage the verified byte snapshot, never re-open a possibly changing
    // source after hashing it under the immutable object's name.
    writeFileSync(target, bytes);
  }
  return assets.size;
}

export function stageChangedAudio(changedPaths, staging, root = process.cwd()) {
  const audio = new Map();
  let manifests = 0;
  for (const path of new Set(changedPaths)) {
    if (!path.startsWith('public/audio/')) continue;
    const key = path.slice('public/audio/'.length);
    if (!managedFileKey(key) || !existsSync(join(root, path))) continue;
    if (key.endsWith('.mp3')) {
      const bytes = readFileSync(join(root, path));
      if (!bytes.length) throw new Error(`${key}: empty recording`);
      audio.set(key, { size: bytes.length, sha256: digest(bytes), sourcePath: key });
    } else {
      mkdirSync(dirname(join(staging, key)), { recursive: true });
      copyFileSync(join(root, path), join(staging, key));
      manifests += 1;
    }
  }
  return stageAudioAssets(immutableAudioAssets(audio, true), staging, root) + manifests;
}

export function repairAudioBatch(assets, { bucket, endpoint, root = process.cwd(), run = execFileSync } = {}) {
  if (!assets.size) return;
  if (!/^[a-z0-9][a-z0-9.-]+$/.test(bucket || '') || !/^https:\/\/[a-fA-F0-9]{32}\.r2\.cloudflarestorage\.com$/.test(endpoint || '')) {
    throw new Error('Valid R2_BUCKET and R2_ENDPOINT are required for targeted repair');
  }
  const staging = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'audio-repair-'));
  try {
    stageAudioAssets(assets, staging, root);
    // One concurrent AWS transfer process, containing ONLY confirmed drift.
    // cp forces repair even if a wrong object happens to have the same size.
    run('aws', ['s3', 'cp', `${staging}/`, `s3://${bucket}/`, '--recursive', '--endpoint-url', endpoint,
      '--only-show-errors', '--cache-control', 'public,max-age=86400'], { stdio: 'inherit' });
  } finally { rmSync(staging, { recursive: true, force: true }); }
}
