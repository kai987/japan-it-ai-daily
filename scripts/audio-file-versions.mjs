import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Task hashes describe synthesis inputs. These hashes describe the bytes served
// to the browser, including recordings reused by a later day's review cards.
export function annotateAudioFileVersions(manifest, audioRoot) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.date || '')) throw new Error('Invalid audio manifest date');
  let recordings = 0;
  for (const [collection, fields] of [['items', ['word', 'example']], ['grammar', ['example']], ['interview', ['audio']], ['review', ['audio']]]) {
    for (const item of manifest[collection] || []) {
      if (item.playback === 'browser-tts') continue;
      const date = item.audioDate ?? manifest.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid audio source date: ${date}`);
      for (const field of fields) {
        const file = item[field];
        if (file == null) continue;
        if (typeof file !== 'string' || !/^[\w-]+\.mp3$/.test(file)) throw new Error(`Invalid audio filename: ${file}`);
        item[`${field}Sha256`] = createHash('sha256').update(readFileSync(join(audioRoot, date, file))).digest('hex');
        recordings += 1;
      }
    }
  }
  return recordings;
}

export function synchronizeAudioFileVersions(audioRoot, { check = false, dates } = {}) {
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
      recordings += annotateAudioFileVersions(manifest, audioRoot);
      manifests += 1;
      const next = `${JSON.stringify(manifest, null, 2)}\n`;
      if (next !== original) updates.push({ path, next });
    }
  }
  if (!check) for (const { path, next } of updates) writeFileSync(path, next);
  return { manifests, recordings, changed: updates.map(({ path }) => path) };
}
