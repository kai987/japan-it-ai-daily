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
