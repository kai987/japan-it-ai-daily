import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { policy } from './daily-quality-policy.mjs';
import { parseInterview, parseReview } from './interview-audio-content.mjs';
import { audioManifestState } from './audio-manifest-state.mjs';
import { reconcileRemoteAssets, verifyRemoteAssets } from './remote-audio.mjs';
import { readStructuredInterview } from './structured-interview.mjs';
import { assertInterviewMirror } from './validate-structured-interviews.mjs';
import { immutableAudioAssets, repairAudioBatch } from './audio-publication.mjs';
export { verifyRemoteAssets } from './remote-audio.mjs';

const normalize = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const assertSame = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: content/audio mapping mismatch`);
};

export const learningRecordingFiles = (items, date) => items.flatMap((item) => {
  if (item.playback === 'browser-tts') {
    if (item.reason !== 'historical-jlpt-repair' || item.word !== null || item.example !== null || item.wordHash || item.exampleHash || item.wordSha256 || item.exampleSha256) {
      throw new Error(`${date}: invalid explicit browser-speech fallback`);
    }
    return [];
  }
  if (item.playback || typeof item.word !== 'string' || typeof item.example !== 'string') {
    throw new Error(`${date}: missing vocabulary recording without explicit fallback`);
  }
  return [item.word, item.example];
});


export const grammarRecordingFiles = (items, date) => items.flatMap((item) => {
  if (item.playback === 'browser-tts') {
    if (item.reason !== 'historical-grammar-repair' || item.example !== null || item.exampleHash || item.exampleSha256) throw new Error(`${date}: invalid explicit grammar browser-speech fallback`);
    return [];
  }
  if (item.playback || typeof item.example !== 'string' || !/^[\w-]+\.mp3$/.test(item.example)) throw new Error(`${date}: missing grammar recording without explicit fallback`);
  return [item.example];
});

export const collectAudioAssets = (root) => {
  const contentRoot = join(root, 'src/content');
  const directories = ['daily', 'daily-ja', 'japanese', 'japanese-ja'];
  const dates = [...new Set(directories.flatMap((dir) => readdirSync(join(contentRoot, dir))))]
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name) && name.slice(0, 10) >= policy.from).sort();
  if (!dates.length) throw new Error('No report dates to verify');
  const assets = new Map();
  const assetsByDate = new Map();
  const pendingDates = [];
  let browserTtsCards = 0;
  const read = (path) => readFileSync(join(root, path), 'utf8');
  for (const name of dates) {
    const date = name.slice(0, 10);
    if (audioManifestState(root, date) === 'pending') {
      pendingDates.push(date);
      continue;
    }
    const audioDir = `public/audio/japanese/${date}`;
    const interview = JSON.parse(read(`${audioDir}/interview-manifest.json`));
    const learning = JSON.parse(read(`${audioDir}/manifest.json`));
    const expectedInterview = (interview.interview ?? []).map((item) => normalize(item.text));
    const expectedReview = (interview.review ?? []).map((item) => normalize(item.text));
    assertSame(interview.date, date, `${date} interview date`);
    assertSame(learning.date, date, `${date} learning date`);
    assertSame(interview.interview?.map((item) => item.type), Array.from({ length: 5 }, () => ['question', 'answer']).flat(), `${date} Q&A roles`);
    if (expectedReview.length !== 3) throw new Error(`${date}: expected three review recordings`);
    const structured = readStructuredInterview(date, root);
    for (const dir of ['daily', 'daily-ja']) {
      const source = read(`src/content/${dir}/${name}`);
      if (structured) assertInterviewMirror(structured, source, dir === 'daily' ? 'zh' : 'ja');
      assertSame(parseInterview(source, { root }).map((item) => normalize(item.text)), expectedInterview, `${dir}/${date} interview`);
      assertSame(parseReview(source, { root }).map(normalize), expectedReview, `${dir}/${date} review`);
    }
    for (const dir of ['japanese', 'japanese-ja']) {
      const source = read(`src/content/${dir}/${name}`);
      const data = parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '');
      const newItems = (learning.items || []).filter((item) => item.studyKind !== 'review');
      const newGrammar = (learning.grammar || []).filter((item) => item.studyKind !== 'review');
      assertSame(data.vocabulary?.map((item) => [item.term, item.reading, item.exampleJa]),
        newItems.map((item) => [item.term, item.reading, item.exampleJa]), `${dir}/${date} vocabulary`);
      assertSame(data.grammar?.map((item) => [item.pattern, item.exampleJa]),
        newGrammar.map((item) => [item.pattern, item.exampleJa]), `${dir}/${date} grammar`);
    }
    for (const item of (learning.items || []).filter((item) => item.studyKind === 'review')) {
      if (!item.identity || !item.firstIntroducedDate || item.firstIntroducedDate >= date || item.audioDate !== item.firstIntroducedDate) {
        throw new Error(`${date}: invalid review vocabulary audio metadata`);
      }
      if (String(item.word || '').startsWith('review-') || String(item.example || '').startsWith('review-')) {
        throw new Error(`${date}: duplicated review vocabulary recording`);
      }
    }
    for (const item of (learning.grammar || []).filter((item) => item.studyKind === 'review')) {
      if (!item.identity || !item.firstIntroducedDate || item.firstIntroducedDate >= date || item.audioDate !== item.firstIntroducedDate) {
        throw new Error(`${date}: invalid review grammar audio metadata`);
      }
      if (String(item.example || '').startsWith('review-')) throw new Error(`${date}: duplicated review grammar recording`);
    }

    browserTtsCards += learning.items.filter((item) => item.playback === 'browser-tts').length;
    const recordingAssets = [
      ...interview.interview.map((item) => ({ audioDate: date, filename: item.audio, sha256: item.audioSha256 })),
      ...interview.review.map((item) => ({ audioDate: date, filename: item.audio, sha256: item.audioSha256 })),
      ...(learning.items || []).flatMap((item) =>
        learningRecordingFiles([item], date).map((filename, index) => ({ audioDate: item.studyKind === 'review' ? item.audioDate : date, filename,
          sha256: index === 0 ? item.wordSha256 : item.exampleSha256 }))),
      ...(learning.grammar || []).flatMap((item) =>
        grammarRecordingFiles([item], date).map((filename) => ({ audioDate: item.studyKind === 'review' ? item.audioDate : date, filename, sha256: item.exampleSha256 }))),
    ];
    const dateAssets = new Set();
    for (const { audioDate, filename, sha256 } of recordingAssets) {
      if (typeof filename !== 'string' || !/^[\w-]+\.mp3$/.test(filename)) throw new Error(`${date}: invalid MP3 filename`);
      if (typeof audioDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(audioDate)) throw new Error(`${date}: invalid audio source date`);
      const path = `japanese/${audioDate}/${filename}`;
      const bytes = readFileSync(join(root, 'public/audio', path));
      if (!bytes.length) throw new Error(`${path}: empty recording`);
      const actualHash = digest(bytes);
      if (sha256 !== undefined && sha256 !== actualHash) throw new Error(`${path}: manifest file SHA-256 mismatch`);
      assets.set(path, { sha256: actualHash, size: bytes.length, sourcePath: path });
      dateAssets.add(path);
    }
    assetsByDate.set(date, dateAssets);
  }
  // The R2 inventory also retains historical, currently unreferenced recordings.
  // Full audits must be able to verify/repair those without a blanket re-upload.
  const publicationAssets = new Map(assets);
  const audioRoot = join(root, 'public/audio/japanese');
  if (existsSync(audioRoot)) {
    for (const directory of readdirSync(audioRoot, { withFileTypes: true })) {
      if (!directory.isDirectory() || !/^\d{4}-\d{2}-\d{2}$/.test(directory.name)) continue;
      for (const file of readdirSync(join(audioRoot, directory.name), { withFileTypes: true })) {
        if (!file.isFile() || !/^[\w-]+\.mp3$/.test(file.name)) continue;
        const key = `japanese/${directory.name}/${file.name}`;
        if (publicationAssets.has(key)) continue;
        const bytes = readFileSync(join(audioRoot, directory.name, file.name));
        if (!bytes.length) throw new Error(`${key}: empty recording`);
        publicationAssets.set(key, { sha256: digest(bytes), size: bytes.length, sourcePath: key });
      }
    }
  }
  return { dates: dates.length, assets, publicationAssets, assetsByDate, pendingDates, browserTtsCards };
};

export function selectRemoteAssets(report, changedPaths, root = process.cwd()) {
  if (changedPaths === undefined) return immutableAudioAssets(report.publicationAssets || report.assets, true);
  const selected = new Map();
  for (const path of changedPaths) {
    const date = path.match(/^(?:public\/audio\/japanese|src\/content\/(?:daily|daily-ja|japanese|japanese-ja))\/(\d{4}-\d{2}-\d{2})(?:\/|\.md$)/)?.[1];
    // A changed manifest/content date can change cross-date review references.
    if (date && !path.endsWith('.mp3')) {
      for (const key of report.assetsByDate.get(date) || []) selected.set(key, report.assets.get(key));
    }
    if (/^public\/audio\/japanese\/\d{4}-\d{2}-\d{2}\/[\w-]+\.mp3$/.test(path) && existsSync(join(root, path))) {
      const key = path.slice('public/audio/'.length);
      const bytes = readFileSync(join(root, path));
      if (!bytes.length) throw new Error(`${key}: empty recording`);
      selected.set(key, report.assets.get(key) || { sha256: digest(bytes), size: bytes.length, sourcePath: key });
    }
  }
  return immutableAudioAssets(selected);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = collectAudioAssets(process.cwd());
  const { dates, assets, pendingDates, browserTtsCards } = report;
  console.log(`Audio integrity: ${dates - pendingDates.length}/${dates} generated dates, bilingual text mappings and ${assets.size} referenced local recordings verified; full local inventory ${report.publicationAssets.size} MP3s; ${browserTtsCards} vocabulary cards explicitly use browser Japanese speech (not recordings).`);
  if (pendingDates.length) console.log(`Audio not generated yet (optional): ${pendingDates.join(', ')}`);
  if (process.argv.includes('--remote')) {
    const base = process.env.PUBLIC_AUDIO_BASE_URL || process.env.R2_PUBLIC_BASE_URL;
    if (!base) throw new Error('Configure PUBLIC_AUDIO_BASE_URL or R2_PUBLIC_BASE_URL');
    const changedIndex = process.argv.indexOf('--changed-file');
    if (changedIndex >= 0 && !process.argv[changedIndex + 1]) throw new Error('--changed-file requires a NUL-delimited Git path list');
    const changed = changedIndex < 0 ? undefined : readFileSync(process.argv[changedIndex + 1], 'utf8').split('\0').filter(Boolean);
    const selected = selectRemoteAssets(report, changed);
    console.log(`Remote audio scope: ${changed === undefined ? 'full' : 'changed files and manifest references'}; ${selected.size} recording(s).`);
    if (process.argv.includes('--repair')) {
      const bucket = process.env.R2_BUCKET;
      const endpoint = process.env.R2_ENDPOINT;
      if (!bucket || !/^[a-z0-9][a-z0-9.-]+$/.test(bucket) || !/^https:\/\/[a-fA-F0-9]{32}\.r2\.cloudflarestorage\.com$/.test(endpoint || '')) {
        throw new Error('Valid R2_BUCKET and R2_ENDPOINT are required for targeted repair');
      }
      const result = await reconcileRemoteAssets(selected, base, undefined, fetch, {
        repairBatch: (confirmed) => {
          console.log(`Repair ${confirmed.size} confirmed remote object(s) in one transfer batch.`);
          repairAudioBatch(confirmed, { bucket, endpoint });
        },
      });
      console.log(`Verified ${result.verified} deployed MP3 SHA-256 hashes; repaired ${result.repaired.length} object(s).`);
    } else console.log(`Verified ${await verifyRemoteAssets(selected, base)} deployed MP3 SHA-256 hashes.`);
  }
}
