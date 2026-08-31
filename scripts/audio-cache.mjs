import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

export const AUDIO_CACHE_VERSION = 1;
export const DEFAULT_MP3_FORMAT = Object.freeze({
  container: 'mp3',
  sampleRate: 24000,
  bitrate: '96k',
  channels: 1,
});

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
};

export const createAudioTaskHash = (payload) => createHash('sha256')
  .update(JSON.stringify(canonicalize({
    cacheVersion: AUDIO_CACHE_VERSION,
    ...payload,
  })))
  .digest('hex');

export const readJsonIfExists = (path) => {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

export const isReusableAudio = ({
  force,
  filePath,
  expectedHash,
  previousHash,
  legacyMatches = false,
}) => {
  if (force || !existsSync(filePath)) return false;
  if (typeof previousHash === 'string' && previousHash) return previousHash === expectedHash;
  return legacyMatches;
};

export const sameNumber = (left, right) => Number(left) === Number(right);
