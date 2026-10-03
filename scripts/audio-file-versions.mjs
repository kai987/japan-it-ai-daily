import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Task hashes describe synthesis inputs. These hashes describe the bytes served
// to the browser, including recordings reused by a later day's review cards.
export function audioFileSha256(filePath) {
  const bytes = readFileSync(filePath);
  if (!bytes.length) throw new Error(`${filePath}: empty audio recording`);
  return createHash('sha256').update(bytes).digest('hex');
}

export function assertAudioFileVersion(filePath, expectedSha256) {
  if (typeof expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw new Error(`${filePath}: missing or invalid recorded file SHA-256; use the explicit audio:versions:write migration after validating the legacy recording`);
  }
  const actual = audioFileSha256(filePath);
  if (actual !== expectedSha256) throw new Error(`${filePath}: recorded file SHA-256 mismatch`);
  return actual;
}

function audioReferences(manifest) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.date || '')) throw new Error('Invalid audio manifest date');
  const references = [];
  for (const [collection, fields] of [['items', ['word', 'example']], ['grammar', ['example']], ['interview', ['audio']], ['review', ['audio']]]) {
    for (const item of manifest[collection] || []) {
      if (item.playback === 'browser-tts') continue;
      const date = item.audioDate ?? manifest.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid audio source date: ${date}`);
      for (const field of fields) {
        const file = item[field];
        if (file == null) continue;
        if (typeof file !== 'string' || !/^[\w-]+\.mp3$/.test(file)) throw new Error(`Invalid audio filename: ${file}`);
        references.push({ item, field: `${field}Sha256`, date, file, key: `${date}/${file}` });
      }
    }
  }
  return references;
}

export function verifiedManifestAudioFileVersion(manifest, audioRoot, date, file, { regenerated } = {}) {
  const path = join(audioRoot, date, file);
  const references = audioReferences(manifest).filter((reference) => reference.date === date && reference.file === file);
  if (!references.length) throw new Error(`${path}: no recording reference in source manifest`);
  const replacement = regenerated?.get(`${date}/${file}`);
  let actual;
  for (const { item, field } of references) {
    actual = assertAudioFileVersion(path, replacement && replacement.previousSha256 === item[field]
      ? replacement.sha256 : item[field]);
  }
  return actual;
}

export function annotateAudioFileVersions(manifest, audioRoot, { regenerated } = {}) {
  const updates = [];
  for (const { item, field, date, file, key } of audioReferences(manifest)) {
    const path = join(audioRoot, date, file);
    const actual = audioFileSha256(path);
    const previous = item[field];
    const replacement = regenerated?.get(key);
    if (replacement && replacement.sha256 !== actual) throw new Error(`${path}: regenerated file SHA-256 mismatch`);
    if (regenerated && !replacement && previous === undefined) {
      // Scoped generator synchronization cannot perform an unrelated legacy
      // migration merely because this manifest references a regenerated file.
      assertAudioFileVersion(path, previous);
    }
    if (previous !== undefined && previous !== actual) {
      // Only a recording synthesized during this run may update later review
      // references, and those references must still name its old trusted hash.
      if (!replacement || replacement.previousSha256 !== previous || replacement.sha256 !== actual) {
        throw new Error(`${path}: recorded file SHA-256 mismatch`);
      }
    }
    updates.push({ item, field, actual });
  }
  // Preserve all trusted metadata if any referenced file fails validation.
  for (const { item, field, actual } of updates) item[field] = actual;
  return updates.length;
}

export function synchronizeAudioFileVersions(audioRoot, { check = false, dates, regenerated } = {}) {
  if (regenerated && !regenerated.size) return { manifests: 0, recordings: 0, changed: [] };
  const selectedDates = dates ?? readdirSync(audioRoot).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  const updates = [];
  let manifests = 0;
  let recordings = 0;
  // Read and validate every selected recording before writing any metadata.
  for (const date of selectedDates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`);
    for (const name of ['manifest.json', 'interview-manifest.json']) {
      const path = join(audioRoot, date, name);
      if (!existsSync(path)) continue;
      const original = readFileSync(path, 'utf8');
      const manifest = JSON.parse(original);
      if (manifest.date !== date) throw new Error(`${path}: date does not match directory`);
      // A generator updates only manifests depending on files it synthesized.
      // The standalone backfill remains the explicit missing-version migration.
      if (regenerated && !audioReferences(manifest).some(({ key }) => regenerated.has(key))) continue;
      recordings += annotateAudioFileVersions(manifest, audioRoot, { regenerated });
      manifests += 1;
      const next = `${JSON.stringify(manifest, null, 2)}\n`;
      if (next !== original) updates.push({ path, next });
    }
  }
  if (!check) for (const { path, next } of updates) writeFileSync(path, next);
  return { manifests, recordings, changed: updates.map(({ path }) => path) };
}
