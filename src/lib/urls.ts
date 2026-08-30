const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:']);

export const getSafeExternalUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
};
