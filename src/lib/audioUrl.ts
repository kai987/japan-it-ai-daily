import { versionedAudioKey } from './audioVersion.mjs';

export type AudioUrlOptions = {
  audioBaseUrl?: string;
  siteBaseUrl?: string;
};

const normalizeSiteBase = (value: string | undefined): string => {
  const trimmed = (value || '/').trim();
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${withLeadingSlash.replace(/\/+$/, '')}/`;
};

const normalizeExternalAudioBase = (value: string | undefined): URL | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return null;
    url.hash = '';
    url.search = '';
    if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
    return url;
  } catch {
    return null;
  }
};

const encodeSegment = (value: unknown): string => encodeURIComponent(String(value ?? '').trim());
const encodedPath = (segments: readonly unknown[]): string =>
  segments.map(encodeSegment).filter(Boolean).join('/');

/** Only byte hashes can version media. Legacy manifests keep their old URL. */
export const versionAudioAssetUrl = (url: string, sha256: unknown): string => {
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sha256)) return url;
  if (/^https:\/\//i.test(url)) {
    const external = new URL(url);
    const directoryEnd = external.pathname.lastIndexOf('/') + 1;
    external.pathname = external.pathname.slice(0, directoryEnd)
      + versionedAudioKey(external.pathname.slice(directoryEnd), sha256);
    external.search = '';
    external.hash = '';
    return external.href;
  }
  const [path, hash] = url.split('#', 2);
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}v=${sha256.toLowerCase()}${hash === undefined ? '' : `#${hash}`}`;
};

export const resolveLocalAudioAssetUrl = (
  segments: readonly unknown[],
  siteBaseUrl = '/',
): string => `${normalizeSiteBase(siteBaseUrl)}audio/${encodedPath(segments)}`;

export const resolveAudioAssetUrl = (
  segments: readonly unknown[],
  options: AudioUrlOptions = {},
): string => {
  const path = encodedPath(segments);
  const externalBase = normalizeExternalAudioBase(options.audioBaseUrl);

  if (externalBase) {
    return new URL(path, externalBase).href;
  }

  return resolveLocalAudioAssetUrl(segments, options.siteBaseUrl);
};

export const localAudioAssetUrl = (...segments: readonly unknown[]): string =>
  resolveLocalAudioAssetUrl(segments, import.meta.env.BASE_URL);

export const configuredAudioAssetUrl = (...segments: readonly unknown[]): string =>
  resolveAudioAssetUrl(segments, {
    audioBaseUrl: import.meta.env.PUBLIC_AUDIO_BASE_URL,
    siteBaseUrl: import.meta.env.BASE_URL,
  });

export const hasExternalAudioBase = (): boolean =>
  normalizeExternalAudioBase(import.meta.env.PUBLIC_AUDIO_BASE_URL) !== null;
