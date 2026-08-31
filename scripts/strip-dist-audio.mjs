import { readdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const configuredAudioBase = process.env.PUBLIC_AUDIO_BASE_URL?.trim() || '';

if (!configuredAudioBase) {
  console.log('PUBLIC_AUDIO_BASE_URL is not configured; keeping local MP3 files in dist/.');
  process.exit(0);
}

const audioUrl = new URL(configuredAudioBase);
if (audioUrl.protocol !== 'https:') {
  throw new Error('PUBLIC_AUDIO_BASE_URL must use HTTPS');
}

const audioRoot = new URL('../dist/audio/', import.meta.url);

const collectMp3 = async (dirUrl) => {
  let entries;
  try {
    entries = await readdir(dirUrl, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dirUrl);
    if (entry.isDirectory()) files.push(...await collectMp3(child));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp3')) files.push(child);
  }
  return files;
};

const files = await collectMp3(audioRoot);
let removedBytes = 0;

for (const fileUrl of files) {
  removedBytes += (await stat(fileUrl)).size;
  await rm(fileUrl);
}

const mib = (removedBytes / 1024 / 1024).toFixed(2);
console.log(`Audio CDN enabled: ${audioUrl.origin}`);
console.log(`Removed ${files.length} MP3 file(s) (${mib} MiB) from the Pages artifact.`);
console.log(`Local manifests remain under ${fileURLToPath(audioRoot)}.`);
