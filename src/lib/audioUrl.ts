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

export const resolveAudioAssetUrl = (
  segments: readonly unknown[],
  options: AudioUrlOptions = {},
): string => {
  const encodedPath = segments.map(encodeSegment).filter(Boolean).join('/');
  const externalBase = normalizeExternalAudioBase(options.audioBaseUrl);

  if (externalBase) {
    return new URL(encodedPath, externalBase).href;
  }

  const siteBase = normalizeSiteBase(options.siteBaseUrl);
  return `${siteBase}audio/${encodedPath}`;
};

export const configuredAudioAssetUrl = (...segments: readonly unknown[]): string =>
  resolveAudioAssetUrl(segments, {
    audioBaseUrl: import.meta.env.PUBLIC_AUDIO_BASE_URL,
    siteBaseUrl: import.meta.env.BASE_URL,
  });
