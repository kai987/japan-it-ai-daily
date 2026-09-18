import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { policy } from './daily-quality-policy.mjs';
import { parseInterview, parseReview } from './interview-audio-content.mjs';

const normalize = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const assertSame = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: content/audio mapping mismatch`);
};

export const learningRecordingFiles = (items, date) => items.flatMap((item) => {
  if (item.playback === 'browser-tts') {
    if (item.reason !== 'historical-jlpt-repair' || item.word !== null || item.example !== null || item.wordHash || item.exampleHash) {
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
    if (item.reason !== 'historical-grammar-repair' || item.example !== null || item.exampleHash) throw new Error(`${date}: invalid explicit grammar browser-speech fallback`);
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
  let browserTtsCards = 0;
  const read = (path) => readFileSync(join(root, path), 'utf8');
  for (const name of dates) {
    const date = name.slice(0, 10);
    const audioDir = `public/audio/japanese/${date}`;
    const interview = JSON.parse(read(`${audioDir}/interview-manifest.json`));
    const learning = JSON.parse(read(`${audioDir}/manifest.json`));
    const expectedInterview = (interview.interview ?? []).map((item) => normalize(item.text));
    const expectedReview = (interview.review ?? []).map((item) => normalize(item.text));
    assertSame(interview.date, date, `${date} interview date`);
    assertSame(learning.date, date, `${date} learning date`);
    assertSame(interview.interview?.map((item) => item.type), Array.from({ length: 5 }, () => ['question', 'answer']).flat(), `${date} Q&A roles`);
    if (expectedReview.length !== 3) throw new Error(`${date}: expected three review recordings`);
    for (const dir of ['daily', 'daily-ja']) {
      const source = read(`src/content/${dir}/${name}`);
      assertSame(parseInterview(source).map((item) => normalize(item.text)), expectedInterview, `${dir}/${date} interview`);
      assertSame(parseReview(source).map(normalize), expectedReview, `${dir}/${date} review`);
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
      ...interview.interview.map((item) => ({ audioDate: date, filename: item.audio })),
      ...interview.review.map((item) => ({ audioDate: date, filename: item.audio })),
      ...(learning.items || []).flatMap((item) =>
        learningRecordingFiles([item], date).map((filename) => ({ audioDate: item.studyKind === 'review' ? item.audioDate : date, filename }))),
      ...(learning.grammar || []).flatMap((item) =>
        grammarRecordingFiles([item], date).map((filename) => ({ audioDate: item.studyKind === 'review' ? item.audioDate : date, filename }))),
    ];
    for (const { audioDate, filename } of recordingAssets) {
      if (typeof filename !== 'string' || !/^[\w-]+\.mp3$/.test(filename)) throw new Error(`${date}: invalid MP3 filename`);
      if (typeof audioDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(audioDate)) throw new Error(`${date}: invalid audio source date`);
      const path = `japanese/${audioDate}/${filename}`;
      const bytes = readFileSync(join(root, 'public/audio', path));
      if (!bytes.length) throw new Error(`${path}: empty recording`);
      assets.set(path, { sha256: digest(bytes), size: bytes.length });
    }
  }
  return { dates: dates.length, assets, browserTtsCards };
};

export const verifyRemoteAssets = async (assets, base, fetcher = fetch) => {
  const url = new URL(base);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  if (url.protocol !== 'https:') throw new Error('Audio public URL must use HTTPS');
  const queue = [...assets.entries()];
  let completed = 0;
  await Promise.all(Array.from({ length: Math.min(8, queue.length) }, async () => {
    while (queue.length) {
      const [path, expected] = queue.shift();
      // Check the exact URL the site uses, including its normal CDN cache.
      const response = await fetcher(new URL(path, url), { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== expected.size || digest(bytes) !== expected.sha256) throw new Error(`${path}: deployed MP3 SHA-256 mismatch`);
      completed += 1;
    }
  }));
  return completed;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { dates, assets, browserTtsCards } = collectAudioAssets(process.cwd());
  console.log(`Audio integrity: ${dates} dates, bilingual text mappings and ${assets.size} local recordings verified; ${browserTtsCards} vocabulary cards explicitly use browser Japanese speech (not recordings).`);
  if (process.argv.includes('--remote')) {
    const base = process.env.PUBLIC_AUDIO_BASE_URL || process.env.R2_PUBLIC_BASE_URL;
    if (!base) throw new Error('Configure PUBLIC_AUDIO_BASE_URL or R2_PUBLIC_BASE_URL');
    const verified = await verifyRemoteAssets(assets, base);
    console.log(`Verified ${verified} deployed MP3 SHA-256 hashes.`);
  }
}
