import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { policy } from './daily-quality-policy.mjs';

const normalize = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sectionQuotes = (source, number) => {
  const section = source.match(new RegExp(`^## ${number}\\.[^\\n]*\\n([\\s\\S]*?)(?=^#{1,2} |(?![\\s\\S]))`, 'm'))?.[1] ?? '';
  return [...section.matchAll(/(?:^>[^\n]*(?:\n|$))+/gm)]
    .map(([block]) => normalize(block.replace(/^>\s?/gm, '')));
};

export const assertSame = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: content/audio mapping mismatch`);
};

export const collectAudioAssets = (root) => {
  const contentRoot = join(root, 'src/content');
  const directories = ['daily', 'daily-ja', 'japanese', 'japanese-ja'];
  const dates = [...new Set(directories.flatMap((dir) => readdirSync(join(contentRoot, dir))))]
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name) && name.slice(0, 10) >= policy.from).sort();
  if (!dates.length) throw new Error('No report dates to verify');
  const assets = new Map();
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
      assertSame(sectionQuotes(source, 3), expectedInterview, `${dir}/${date} interview`);
      assertSame(sectionQuotes(source, 5), expectedReview, `${dir}/${date} review`);
    }
    for (const dir of ['japanese', 'japanese-ja']) {
      const source = read(`src/content/${dir}/${name}`);
      const data = parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '');
      assertSame(data.vocabulary?.map((item) => [item.term, item.reading, item.exampleJa]),
        learning.items?.map((item) => [item.term, item.reading, item.exampleJa]), `${dir}/${date} vocabulary`);
      assertSame(data.grammar?.map((item) => [item.pattern, item.exampleJa]),
        learning.grammar?.map((item) => [item.pattern, item.exampleJa]), `${dir}/${date} grammar`);
    }
    const filenames = [
      ...interview.interview.map((item) => item.audio), ...interview.review.map((item) => item.audio),
      ...learning.items.flatMap((item) => [item.word, item.example]), ...learning.grammar.map((item) => item.example),
    ];
    for (const filename of filenames) {
      if (typeof filename !== 'string' || !/^[\w-]+\.mp3$/.test(filename)) throw new Error(`${date}: invalid MP3 filename`);
      const path = `japanese/${date}/${filename}`;
      const bytes = readFileSync(join(root, 'public/audio', path));
      if (!bytes.length) throw new Error(`${path}: empty recording`);
      assets.set(path, { sha256: digest(bytes), size: bytes.length });
    }
  }
  return { dates: dates.length, assets };
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
  const { dates, assets } = collectAudioAssets(process.cwd());
  console.log(`Audio integrity: ${dates} dates, bilingual text mappings and ${assets.size} local recordings verified.`);
  if (process.argv.includes('--remote')) {
    const base = process.env.PUBLIC_AUDIO_BASE_URL || process.env.R2_PUBLIC_BASE_URL;
    if (!base) throw new Error('Configure PUBLIC_AUDIO_BASE_URL or R2_PUBLIC_BASE_URL');
    const verified = await verifyRemoteAssets(assets, base);
    console.log(`Verified ${verified} deployed MP3 SHA-256 hashes.`);
  }
}
