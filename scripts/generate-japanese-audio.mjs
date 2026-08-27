import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_STYLE_ID = 497929760;
const DEFAULT_ENGINE_URL = 'http://127.0.0.1:10101';
const WORD_SPEED = Number(process.env.AIVIS_WORD_SPEED || '0.90');
const EXAMPLE_SPEED = Number(process.env.AIVIS_EXAMPLE_SPEED || '0.96');
const STYLE_ID = Number(process.env.AIVIS_STYLE_ID || DEFAULT_STYLE_ID);
const ENGINE_URL = (process.env.AIVIS_ENGINE_URL || DEFAULT_ENGINE_URL).replace(/\/$/, '');

const root = resolve(process.cwd());
const contentDir = join(root, 'src', 'content', 'japanese');
const args = process.argv.slice(2);
const force = args.includes('--force');

const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const requestedDate = argValue('--date');
const useLatest = args.includes('--latest') || !requestedDate;

const fail = (message) => {
  console.error(`\n[AivisSpeech] ${message}\n`);
  process.exit(1);
};

const parseScalar = (raw = '') => {
  const value = raw.trim();
  if (!value) return '';
  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, value.endsWith('"') ? -1 : undefined);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
};

const extractField = (segment, field) => {
  const match = segment.match(new RegExp(`^\\s{4}${field}:\\s*(.+)$`, 'm'));
  return match ? parseScalar(match[1]) : '';
};

const parseVocabulary = (source) => {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/m)?.[1] ?? '';
  const vocabularyBlock = frontmatter.match(/(?:^|\n)vocabulary:\s*\n([\s\S]*?)(?=\ngrammar:\s*\n)/)?.[1] ?? '';
  const itemStarts = Array.from(vocabularyBlock.matchAll(/^\s{2}- term:\s*(.+)$/gm));

  return itemStarts.map((match, index) => {
    const start = match.index ?? 0;
    const end = itemStarts[index + 1]?.index ?? vocabularyBlock.length;
    const segment = vocabularyBlock.slice(start, end);
    return {
      term: parseScalar(match[1]),
      reading: extractField(segment, 'reading'),
      exampleJa: extractField(segment, 'exampleJa'),
    };
  }).filter((item) => item.term && item.exampleJa);
};

const latestDate = () => {
  const dates = readdirSync(contentDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .map((name) => basename(name, '.md'))
    .sort();
  return dates.at(-1);
};

const date = useLatest ? latestDate() : requestedDate;
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  fail('日期格式不正确。请使用 --date YYYY-MM-DD，例如 --date 2026-08-26。');
}

const contentPath = join(contentDir, `${date}.md`);
if (!existsSync(contentPath)) fail(`找不到 ${contentPath}`);

if (!Number.isFinite(STYLE_ID)) fail('AIVIS_STYLE_ID 必须是数字。');
if (!Number.isFinite(WORD_SPEED) || !Number.isFinite(EXAMPLE_SPEED)) fail('语速配置必须是数字。');

const ffmpegCheck = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
if (ffmpegCheck.status !== 0) {
  fail('找不到 ffmpeg。请先执行：brew install ffmpeg');
}

const source = readFileSync(contentPath, 'utf8');
const vocabulary = parseVocabulary(source);
if (!vocabulary.length) fail(`${date} 没有解析到 vocabulary / exampleJa。`);

const api = async (path, options = {}) => {
  let response;
  try {
    response = await fetch(`${ENGINE_URL}${path}`, options);
  } catch (error) {
    fail(`无法连接 ${ENGINE_URL}。请保持 AivisSpeech 开启。\n${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${options.method || 'GET'} ${path} → HTTP ${response.status}${detail ? `\n${detail}` : ''}`);
  }
  return response;
};

const findVoice = async () => {
  const response = await api('/speakers');
  const speakers = await response.json();
  for (const speaker of speakers) {
    const style = speaker.styles?.find((item) => Number(item.id) === STYLE_ID);
    if (style) return { speaker, style };
  }
  fail(`AivisSpeech 中找不到 Style ID ${STYLE_ID}。请重新执行 /speakers 确认。`);
};

const createQuery = async (text, kind) => {
  const url = new URL(`${ENGINE_URL}/audio_query`);
  url.searchParams.set('text', text);
  url.searchParams.set('speaker', String(STYLE_ID));
  const response = await fetch(url, { method: 'POST' });
  if (!response.ok) throw new Error(`audio_query failed: HTTP ${response.status} ${await response.text()}`);
  const query = await response.json();
  query.speedScale = kind === 'word' ? WORD_SPEED : EXAMPLE_SPEED;
  query.intonationScale = 1.0;
  query.volumeScale = 1.0;
  query.prePhonemeLength = kind === 'word' ? 0.06 : 0.10;
  query.postPhonemeLength = kind === 'word' ? 0.08 : 0.12;
  if ('outputSamplingRate' in query) query.outputSamplingRate = 24000;
  if ('outputStereo' in query) query.outputStereo = false;
  return query;
};

const synthesize = async (text, kind) => {
  const query = await createQuery(text, kind);
  const url = new URL(`${ENGINE_URL}/synthesis`);
  url.searchParams.set('speaker', String(STYLE_ID));
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!response.ok) throw new Error(`synthesis failed: HTTP ${response.status} ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
};

const encodeMp3 = (wav, outputPath) => {
  const tempPath = join(tmpdir(), `aivis-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.wav`);
  writeFileSync(tempPath, wav);
  try {
    const result = spawnSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-i', tempPath, '-map_metadata', '-1', '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '96k', outputPath],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) throw new Error(result.stderr || 'ffmpeg 转码失败');
  } finally {
    rmSync(tempPath, { force: true });
  }
};

const pad = (value) => String(value).padStart(2, '0');
const outputDir = join(root, 'public', 'audio', 'japanese', date);
mkdirSync(outputDir, { recursive: true });

const { speaker, style } = await findVoice();
console.log(`\nAivisSpeech: ${speaker.name} / ${style.name} / Style ID ${STYLE_ID}`);
console.log(`Date: ${date}`);
console.log(`Words: ${vocabulary.length}`);
console.log(`Output: ${outputDir}\n`);

const manifestItems = [];
let generated = 0;
let skipped = 0;

for (const [zeroIndex, item] of vocabulary.entries()) {
  const index = zeroIndex + 1;
  const wordFile = `vocab-${pad(index)}.mp3`;
  const exampleFile = `example-${pad(index)}.mp3`;
  const wordPath = join(outputDir, wordFile);
  const examplePath = join(outputDir, exampleFile);
  const wordText = item.reading || item.term;

  for (const task of [
    { kind: 'word', text: wordText, file: wordFile, path: wordPath },
    { kind: 'example', text: item.exampleJa, file: exampleFile, path: examplePath },
  ]) {
    if (!force && existsSync(task.path)) {
      skipped += 1;
      console.log(`SKIP ${task.file}`);
      continue;
    }
    process.stdout.write(`GEN  ${task.file}  ${task.text}\n`);
    try {
      const wav = await synthesize(task.text, task.kind);
      encodeMp3(wav, task.path);
      generated += 1;
    } catch (error) {
      fail(`${task.file} 生成失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  manifestItems.push({
    index,
    term: item.term,
    reading: item.reading,
    exampleJa: item.exampleJa,
    word: wordFile,
    example: exampleFile,
  });
}

const manifest = {
  date,
  generatedAt: new Date().toISOString(),
  engineUrl: ENGINE_URL,
  voice: {
    name: speaker.name,
    style: style.name,
    styleId: STYLE_ID,
    speakerUuid: speaker.speaker_uuid,
    modelVersion: speaker.version,
  },
  format: { container: 'mp3', sampleRate: 24000, bitrate: '96k', channels: 1 },
  settings: { wordSpeed: WORD_SPEED, exampleSpeed: EXAMPLE_SPEED, intonationScale: 1.0 },
  items: manifestItems,
};

writeFileSync(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`\n完成：新生成 ${generated} 个，跳过 ${skipped} 个。`);
console.log(`Manifest: ${join(outputDir, 'manifest.json')}\n`);
