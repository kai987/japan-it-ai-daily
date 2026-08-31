import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  AUDIO_CACHE_VERSION,
  DEFAULT_MP3_FORMAT,
  createAudioTaskHash,
  isReusableAudio,
  readJsonIfExists,
  sameNumber,
} from './audio-cache.mjs';

const DEFAULT_STYLE_ID = 497929760;
const DEFAULT_ENGINE_URL = 'http://127.0.0.1:10101';
const WORD_SPEED = Number(process.env.AIVIS_WORD_SPEED || '1.00');
const EXAMPLE_SPEED = Number(process.env.AIVIS_EXAMPLE_SPEED || '1.00');
const STYLE_ID = Number(process.env.AIVIS_STYLE_ID || DEFAULT_STYLE_ID);
const ENGINE_URL = (process.env.AIVIS_ENGINE_URL || DEFAULT_ENGINE_URL).replace(/\/$/, '');

const root = resolve(process.cwd());
const contentDir = join(root, 'src', 'content', 'japanese');
const args = process.argv.slice(2);
const force = args.includes('--force');
const generateAll = args.includes('--all');

const argValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const requestedDate = argValue('--date');
const useLatest = args.includes('--latest') || (!requestedDate && !generateAll);

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
  const match = segment.match(new RegExp(`^\\s+${field}:\\s*(.+)$`, 'm'));
  return match ? parseScalar(match[1]) : '';
};

const extractFlowField = (segment, field) => {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(?:^|,\\s*)${escaped}:\\s*(.*?)(?=,\\s*[A-Za-z][A-Za-z0-9]*:\\s*|$)`,
  );
  const match = segment.match(pattern);
  return match ? parseScalar(match[1]) : '';
};

const frontmatterOf = (source) => source.match(/^---\r?\n([\s\S]*?)\r?\n---/m)?.[1] ?? '';

const parseVocabulary = (source) => {
  const frontmatter = frontmatterOf(source);
  const vocabularyBlock = frontmatter.match(/(?:^|\n)vocabulary:\s*\n([\s\S]*?)(?=\ngrammar:\s*\n)/)?.[1] ?? '';

  const flowItems = Array.from(vocabularyBlock.matchAll(/^\s*-\s*\{(.+)\}\s*$/gm));
  if (flowItems.length) {
    return flowItems
      .map((match) => {
        const segment = match[1] ?? '';
        return {
          term: extractFlowField(segment, 'term'),
          reading: extractFlowField(segment, 'reading'),
          exampleJa: extractFlowField(segment, 'exampleJa'),
        };
      })
      .filter((item) => item.term && item.exampleJa);
  }

  const itemStarts = Array.from(vocabularyBlock.matchAll(/^\s*-\s+term:\s*(.+)$/gm));
  return itemStarts
    .map((match, index) => {
      const start = match.index ?? 0;
      const end = itemStarts[index + 1]?.index ?? vocabularyBlock.length;
      const segment = vocabularyBlock.slice(start, end);
      return {
        term: parseScalar(match[1]),
        reading: extractField(segment, 'reading'),
        exampleJa: extractField(segment, 'exampleJa'),
      };
    })
    .filter((item) => item.term && item.exampleJa);
};

const parseGrammar = (source) => {
  const frontmatter = frontmatterOf(source);
  const grammarBlock = frontmatter.match(
    /(?:^|\n)grammar:\s*\n([\s\S]*?)(?=\n(?:technicalTerms|mustRememberWords|mustRememberGrammar):|$)/,
  )?.[1] ?? '';

  const flowItems = Array.from(grammarBlock.matchAll(/^\s*-\s*\{(.+)\}\s*$/gm));
  if (flowItems.length) {
    return flowItems
      .map((match) => {
        const segment = match[1] ?? '';
        return {
          pattern: extractFlowField(segment, 'pattern'),
          exampleJa: extractFlowField(segment, 'exampleJa'),
        };
      })
      .filter((item) => item.pattern && item.exampleJa);
  }

  const itemStarts = Array.from(grammarBlock.matchAll(/^\s*-\s+pattern:\s*(.+)$/gm));
  return itemStarts
    .map((match, index) => {
      const start = match.index ?? 0;
      const end = itemStarts[index + 1]?.index ?? grammarBlock.length;
      const segment = grammarBlock.slice(start, end);
      return {
        pattern: parseScalar(match[1]),
        exampleJa: extractField(segment, 'exampleJa'),
      };
    })
    .filter((item) => item.pattern && item.exampleJa);
};

const allDates = () => readdirSync(contentDir)
  .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
  .map((name) => basename(name, '.md'))
  .sort();

const dates = allDates();
if (!dates.length) fail(`找不到 ${contentDir} 下的日语学习文件。`);

if (generateAll && requestedDate) {
  fail('不能同时使用 --all 和 --date。');
}

let targetDates;
if (generateAll) {
  targetDates = dates;
} else if (useLatest) {
  targetDates = [dates.at(-1)];
} else {
  if (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    fail('日期格式不正确。请使用 --date YYYY-MM-DD，例如 --date 2026-08-26。');
  }
  targetDates = [requestedDate];
}

for (const date of targetDates) {
  const contentPath = join(contentDir, `${date}.md`);
  if (!existsSync(contentPath)) fail(`找不到 ${contentPath}`);
}

if (!Number.isFinite(STYLE_ID)) fail('AIVIS_STYLE_ID 必须是数字。');
if (!Number.isFinite(WORD_SPEED) || !Number.isFinite(EXAMPLE_SPEED)) fail('语速配置必须是数字。');

const ffmpegCheck = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
if (ffmpegCheck.status !== 0) {
  fail('找不到 ffmpeg。请先执行：brew install ffmpeg');
}

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

const synthesisSettings = (kind) => ({
  speedScale: kind === 'word' ? WORD_SPEED : EXAMPLE_SPEED,
  intonationScale: 1.0,
  volumeScale: 1.0,
  prePhonemeLength: kind === 'word' ? 0.06 : 0.10,
  postPhonemeLength: kind === 'word' ? 0.08 : 0.12,
  outputSamplingRate: 24000,
  outputStereo: false,
});

const createQuery = async (text, kind) => {
  const url = new URL(`${ENGINE_URL}/audio_query`);
  url.searchParams.set('text', text);
  url.searchParams.set('speaker', String(STYLE_ID));
  const response = await fetch(url, { method: 'POST' });
  if (!response.ok) throw new Error(`audio_query failed: HTTP ${response.status} ${await response.text()}`);
  const query = await response.json();
  const settings = synthesisSettings(kind);
  query.speedScale = settings.speedScale;
  query.intonationScale = settings.intonationScale;
  query.volumeScale = settings.volumeScale;
  query.prePhonemeLength = settings.prePhonemeLength;
  query.postPhonemeLength = settings.postPhonemeLength;
  if ('outputSamplingRate' in query) query.outputSamplingRate = settings.outputSamplingRate;
  if ('outputStereo' in query) query.outputStereo = settings.outputStereo;
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
const { speaker, style } = await findVoice();
const voiceFingerprint = {
  styleId: STYLE_ID,
  speakerUuid: speaker.speaker_uuid ?? '',
  modelVersion: speaker.version ?? '',
};

const taskHash = (text, kind, scope) => createAudioTaskHash({
  scope,
  text,
  voice: voiceFingerprint,
  synthesis: synthesisSettings(kind),
  format: DEFAULT_MP3_FORMAT,
});

const legacyManifestMatchesConfig = (manifest) => Boolean(
  manifest
  && manifest.engineUrl === ENGINE_URL
  && sameNumber(manifest.voice?.styleId, STYLE_ID)
  && String(manifest.voice?.speakerUuid ?? '') === String(voiceFingerprint.speakerUuid)
  && String(manifest.voice?.modelVersion ?? '') === String(voiceFingerprint.modelVersion)
  && sameNumber(manifest.settings?.wordSpeed, WORD_SPEED)
  && sameNumber(manifest.settings?.exampleSpeed, EXAMPLE_SPEED)
  && sameNumber(manifest.settings?.intonationScale, 1)
  && manifest.format?.container === DEFAULT_MP3_FORMAT.container
  && sameNumber(manifest.format?.sampleRate, DEFAULT_MP3_FORMAT.sampleRate)
  && manifest.format?.bitrate === DEFAULT_MP3_FORMAT.bitrate
  && sameNumber(manifest.format?.channels, DEFAULT_MP3_FORMAT.channels)
);

const previousAudioRecords = (manifest) => {
  const records = new Map();
  for (const item of Array.isArray(manifest?.items) ? manifest.items : []) {
    if (item?.word) {
      records.set(item.word, {
        hash: item.wordHash,
        text: item.reading || item.term || '',
      });
    }
    if (item?.example) {
      records.set(item.example, {
        hash: item.exampleHash,
        text: item.exampleJa || '',
      });
    }
  }
  for (const item of Array.isArray(manifest?.grammar) ? manifest.grammar : []) {
    if (item?.example) {
      records.set(item.example, {
        hash: item.exampleHash,
        text: item.exampleJa || '',
      });
    }
  }
  return records;
};

console.log(`\nAivisSpeech: ${speaker.name} / ${style.name} / Style ID ${STYLE_ID}`);
console.log(`Speed: word=${WORD_SPEED.toFixed(2)}, example=${EXAMPLE_SPEED.toFixed(2)}`);
console.log(`Target dates: ${targetDates.length}${generateAll ? ' (ALL)' : ''}`);
console.log(`Force overwrite: ${force ? 'YES' : 'NO'}`);
console.log(`Audio cache: SHA-256 v${AUDIO_CACHE_VERSION}\n`);

let totalGenerated = 0;
let totalSkipped = 0;
let totalMigrated = 0;
let processedDates = 0;

for (const date of targetDates) {
  const contentPath = join(contentDir, `${date}.md`);
  const source = readFileSync(contentPath, 'utf8');
  const vocabulary = parseVocabulary(source);
  const grammar = parseGrammar(source);

  if (!vocabulary.length && !grammar.length) {
    console.warn(`WARN ${date}: 没有解析到 vocabulary / grammar 的 exampleJa，已跳过。`);
    continue;
  }

  const outputDir = join(root, 'public', 'audio', 'japanese', date);
  mkdirSync(outputDir, { recursive: true });
  const manifestPath = join(outputDir, 'manifest.json');
  const previousManifest = readJsonIfExists(manifestPath);
  const previousRecords = previousAudioRecords(previousManifest);
  const legacyConfigMatches = legacyManifestMatchesConfig(previousManifest);

  console.log(`\n=== ${date} · ${vocabulary.length} words · ${grammar.length} grammar ===`);
  console.log(`Output: ${outputDir}`);

  const manifestItems = [];
  const manifestGrammar = [];
  let generated = 0;
  let skipped = 0;
  let migrated = 0;

  const ensureAudio = async ({ file, path, text, kind, scope }) => {
    const expectedHash = taskHash(text, kind, scope);
    const previous = previousRecords.get(file);
    const legacyMatches = Boolean(
      legacyConfigMatches
      && previous
      && !previous.hash
      && previous.text === text
    );

    if (isReusableAudio({
      force,
      filePath: path,
      expectedHash,
      previousHash: previous?.hash,
      legacyMatches,
    })) {
      skipped += 1;
      if (legacyMatches) migrated += 1;
      console.log(`SKIP ${file}${legacyMatches ? '  [cache migrated]' : '  [hash match]'}`);
      return expectedHash;
    }

    process.stdout.write(`${existsSync(path) ? 'REGEN' : 'GEN  '} ${file}  ${text}\n`);
    try {
      const wav = await synthesize(text, kind);
      encodeMp3(wav, path);
      generated += 1;
      return expectedHash;
    } catch (error) {
      fail(`${date}/${file} 生成失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  for (const [zeroIndex, item] of vocabulary.entries()) {
    const index = zeroIndex + 1;
    const wordFile = `vocab-${pad(index)}.mp3`;
    const exampleFile = `example-${pad(index)}.mp3`;
    const wordPath = join(outputDir, wordFile);
    const examplePath = join(outputDir, exampleFile);
    const wordText = item.reading || item.term;

    const wordHash = await ensureAudio({
      file: wordFile,
      path: wordPath,
      text: wordText,
      kind: 'word',
      scope: 'japanese-vocabulary-word',
    });
    const exampleHash = await ensureAudio({
      file: exampleFile,
      path: examplePath,
      text: item.exampleJa,
      kind: 'example',
      scope: 'japanese-vocabulary-example',
    });

    manifestItems.push({
      index,
      term: item.term,
      reading: item.reading,
      exampleJa: item.exampleJa,
      word: wordFile,
      wordHash,
      example: exampleFile,
      exampleHash,
    });
  }

  for (const [zeroIndex, item] of grammar.entries()) {
    const index = zeroIndex + 1;
    const exampleFile = `grammar-example-${pad(index)}.mp3`;
    const examplePath = join(outputDir, exampleFile);
    const exampleHash = await ensureAudio({
      file: exampleFile,
      path: examplePath,
      text: item.exampleJa,
      kind: 'example',
      scope: 'japanese-grammar-example',
    });

    manifestGrammar.push({
      index,
      pattern: item.pattern,
      exampleJa: item.exampleJa,
      example: exampleFile,
      exampleHash,
    });
  }

  const changed = generated > 0 || migrated > 0 || !previousManifest;
  const manifest = {
    date,
    generatedAt: changed
      ? new Date().toISOString()
      : previousManifest.generatedAt ?? new Date().toISOString(),
    audioCache: {
      version: AUDIO_CACHE_VERSION,
      algorithm: 'sha256',
    },
    engineUrl: ENGINE_URL,
    voice: {
      name: speaker.name,
      style: style.name,
      styleId: STYLE_ID,
      speakerUuid: speaker.speaker_uuid,
      modelVersion: speaker.version,
    },
    format: { ...DEFAULT_MP3_FORMAT },
    settings: { wordSpeed: WORD_SPEED, exampleSpeed: EXAMPLE_SPEED, intonationScale: 1.0 },
    items: manifestItems,
    grammar: manifestGrammar,
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`完成 ${date}：生成/更新 ${generated} 个，跳过 ${skipped} 个，迁移 hash ${migrated} 个。`);

  totalGenerated += generated;
  totalSkipped += skipped;
  totalMigrated += migrated;
  processedDates += 1;
}

console.log('\n========================================');
console.log(`全部完成：${processedDates}/${targetDates.length} 天`);
console.log(`生成/更新：${totalGenerated} 个 MP3`);
console.log(`跳过：${totalSkipped} 个 MP3`);
console.log(`迁移 hash：${totalMigrated} 个 MP3`);
console.log(`Voice: ${speaker.name} / ${style.name} / ${STYLE_ID}`);
console.log(`Speed: ${WORD_SPEED.toFixed(2)} / ${EXAMPLE_SPEED.toFixed(2)}`);
console.log('========================================\n');
