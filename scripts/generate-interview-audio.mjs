import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_STYLE_ID = 497929760;
const DEFAULT_ENGINE_URL = 'http://127.0.0.1:10101';
const INTERVIEW_SPEED = Number(process.env.AIVIS_INTERVIEW_SPEED || process.env.AIVIS_EXAMPLE_SPEED || '1.00');
const STYLE_ID = Number(process.env.AIVIS_STYLE_ID || DEFAULT_STYLE_ID);
const ENGINE_URL = (process.env.AIVIS_ENGINE_URL || DEFAULT_ENGINE_URL).replace(/\/$/, '');

const root = resolve(process.cwd());
const contentDir = join(root, 'src', 'content', 'daily');
const args = process.argv.slice(2);
const force = args.includes('--force');
const generateAll = args.includes('--all');

const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const requestedDate = argValue('--date');
const useLatest = args.includes('--latest') || (!requestedDate && !generateAll);
const normalizeText = (value = '') => value.replace(/^>\s?/gm, '').replace(/\s+/g, ' ').trim();
const fail = (message) => {
  console.error(`\n[AivisSpeech Interview] ${message}\n`);
  process.exit(1);
};

const extractSection = (source, title) => {
  const lines = source.split(/\r?\n/);
  let start = -1;
  let depth = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;
    if ((match[2] || '').includes(title)) {
      start = i + 1;
      depth = match[1].length;
      break;
    }
  }
  if (start < 0) return '';
  const out = [];
  for (let i = start; i < lines.length; i += 1) {
    const heading = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (heading && heading[1].length <= depth) break;
    out.push(lines[i]);
  }
  return out.join('\n');
};

const quoteBlocks = (section) => {
  const lines = section.split(/\r?\n/);
  const blocks = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const text = normalizeText(current.join(' '));
    if (text) blocks.push(text);
    current = [];
  };
  for (const line of lines) {
    if (/^>\s?/.test(line.trim())) current.push(line.trim());
    else flush();
  }
  flush();
  return blocks;
};

const parseInterview = (source) => {
  const section = extractSection(source, '面接で使えるポイント');
  if (!section) return [];
  const lines = section.split(/\r?\n/);
  const items = [];
  let role = '';
  let quote = [];
  const flush = () => {
    if (!quote.length) return;
    const text = normalizeText(quote.join(' '));
    if (text) items.push({ type: role || 'answer', text });
    quote = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\*\*.*面试问题.*\*\*/.test(trimmed)) {
      flush();
      role = 'question';
      continue;
    }
    if (/^\*\*.*(?:约|約)\s*30\s*秒.*(?:日语|日本語).*回答.*\*\*/.test(trimmed)) {
      flush();
      role = 'answer';
      continue;
    }
    if (/^>\s?/.test(trimmed)) quote.push(trimmed);
    else flush();
  }
  flush();

  if (items.length) return items;
  return quoteBlocks(section).map((text) => ({ type: 'answer', text }));
};

const parseReview = (source) => {
  const section = extractSection(source, '面试复习卡');
  if (!section) return [];
  const quoted = quoteBlocks(section);
  if (quoted.length) return quoted;

  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^-\s+/.test(line))
    .map((line) => line.replace(/^-\s+/, '').split(/\s*→\s*/)[0] || '')
    .map((line) => line.replace(/^`|`$/g, '').trim())
    .filter((line) => /[ぁ-んァ-ヶ一-龠]/.test(line));
};

const allDates = () => readdirSync(contentDir)
  .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
  .map((name) => basename(name, '.md'))
  .sort();

const dates = allDates();
if (!dates.length) fail(`找不到 ${contentDir} 下的日报文件。`);
if (generateAll && requestedDate) fail('不能同时使用 --all 和 --date。');

let targetDates;
if (generateAll) targetDates = dates;
else if (useLatest) targetDates = [dates.at(-1)];
else {
  if (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    fail('日期格式不正确。请使用 --date YYYY-MM-DD。');
  }
  targetDates = [requestedDate];
}

if (!Number.isFinite(STYLE_ID)) fail('AIVIS_STYLE_ID 必须是数字。');
if (!Number.isFinite(INTERVIEW_SPEED)) fail('AIVIS_INTERVIEW_SPEED 必须是数字。');
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status !== 0) fail('找不到 ffmpeg。请先执行：brew install ffmpeg');

const api = async (path, options = {}) => {
  let response;
  try {
    response = await fetch(`${ENGINE_URL}${path}`, options);
  } catch (error) {
    fail(`无法连接 ${ENGINE_URL}。请保持 AivisSpeech 开启。\n${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} → HTTP ${response.status} ${await response.text().catch(() => '')}`);
  return response;
};

const findVoice = async () => {
  const speakers = await (await api('/speakers')).json();
  for (const speaker of speakers) {
    const style = speaker.styles?.find((item) => Number(item.id) === STYLE_ID);
    if (style) return { speaker, style };
  }
  fail(`AivisSpeech 中找不到 Style ID ${STYLE_ID}。`);
};

const synthesize = async (text) => {
  const queryUrl = new URL(`${ENGINE_URL}/audio_query`);
  queryUrl.searchParams.set('text', text);
  queryUrl.searchParams.set('speaker', String(STYLE_ID));
  const queryResponse = await fetch(queryUrl, { method: 'POST' });
  if (!queryResponse.ok) throw new Error(`audio_query failed: HTTP ${queryResponse.status}`);
  const query = await queryResponse.json();
  query.speedScale = INTERVIEW_SPEED;
  query.intonationScale = 1.0;
  query.volumeScale = 1.0;
  query.prePhonemeLength = 0.10;
  query.postPhonemeLength = 0.12;
  if ('outputSamplingRate' in query) query.outputSamplingRate = 24000;
  if ('outputStereo' in query) query.outputStereo = false;

  const synthesisUrl = new URL(`${ENGINE_URL}/synthesis`);
  synthesisUrl.searchParams.set('speaker', String(STYLE_ID));
  const response = await fetch(synthesisUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!response.ok) throw new Error(`synthesis failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
};

const encodeMp3 = (wav, outputPath) => {
  const tempPath = join(tmpdir(), `aivis-interview-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.wav`);
  writeFileSync(tempPath, wav);
  try {
    const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tempPath, '-map_metadata', '-1', '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '96k', outputPath], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || 'ffmpeg 转码失败');
  } finally {
    rmSync(tempPath, { force: true });
  }
};

const pad = (value) => String(value).padStart(2, '0');
const { speaker, style } = await findVoice();
console.log(`\nAivisSpeech Interview: ${speaker.name} / ${style.name} / Style ID ${STYLE_ID}`);
console.log(`Speed: interview=${INTERVIEW_SPEED.toFixed(2)}`);
console.log(`Target dates: ${targetDates.length}${generateAll ? ' (ALL)' : ''}`);
console.log(`Force overwrite: ${force ? 'YES' : 'NO'}\n`);

let totalGenerated = 0;
let totalSkipped = 0;
let processedDates = 0;

for (const date of targetDates) {
  const contentPath = join(contentDir, `${date}.md`);
  if (!existsSync(contentPath)) continue;
  const source = readFileSync(contentPath, 'utf8');
  const interview = parseInterview(source);
  const review = parseReview(source);
  if (!interview.length && !review.length) {
    console.log(`SKIP ${date}: 没有面试语音内容。`);
    continue;
  }

  const outputDir = join(root, 'public', 'audio', 'japanese', date);
  mkdirSync(outputDir, { recursive: true });
  let questionIndex = 0;
  let answerIndex = 0;
  let reviewIndex = 0;
  let generated = 0;
  let skipped = 0;
  const manifestInterview = [];
  const manifestReview = [];

  console.log(`\n=== ${date} · ${interview.length} interview · ${review.length} review ===`);

  for (const item of interview) {
    const index = item.type === 'question' ? ++questionIndex : ++answerIndex;
    const file = `interview-${item.type}-${pad(index)}.mp3`;
    const path = join(outputDir, file);
    if (!force && existsSync(path)) {
      skipped += 1;
      console.log(`SKIP ${file}`);
    } else {
      console.log(`GEN  ${file}  ${item.text}`);
      try {
        encodeMp3(await synthesize(item.text), path);
        generated += 1;
      } catch (error) {
        fail(`${date}/${file} 生成失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    manifestInterview.push({ index, type: item.type, text: item.text, audio: file });
  }

  for (const text of review) {
    const index = ++reviewIndex;
    const file = `review-question-${pad(index)}.mp3`;
    const path = join(outputDir, file);
    if (!force && existsSync(path)) {
      skipped += 1;
      console.log(`SKIP ${file}`);
    } else {
      console.log(`GEN  ${file}  ${text}`);
      try {
        encodeMp3(await synthesize(text), path);
        generated += 1;
      } catch (error) {
        fail(`${date}/${file} 生成失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    manifestReview.push({ index, text, audio: file });
  }

  const manifest = {
    date,
    generatedAt: new Date().toISOString(),
    voice: {
      name: speaker.name,
      style: style.name,
      styleId: STYLE_ID,
      speakerUuid: speaker.speaker_uuid,
      modelVersion: speaker.version,
    },
    settings: { speed: INTERVIEW_SPEED, intonationScale: 1.0 },
    interview: manifestInterview,
    review: manifestReview,
  };
  writeFileSync(join(outputDir, 'interview-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`完成 ${date}：新生成 ${generated} 个，跳过 ${skipped} 个。`);
  totalGenerated += generated;
  totalSkipped += skipped;
  processedDates += 1;
}

console.log('\n========================================');
console.log(`全部完成：${processedDates}/${targetDates.length} 天`);
console.log(`新生成：${totalGenerated} 个 MP3`);
console.log(`跳过：${totalSkipped} 个 MP3`);
console.log(`Voice: ${speaker.name} / ${style.name} / ${STYLE_ID}`);
console.log(`Speed: ${INTERVIEW_SPEED.toFixed(2)}`);
console.log('========================================\n');
