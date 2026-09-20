/** Immutable object keys are shared by browser URLs, staging and verification. */
export function versionedAudioKey(path, sha256) {
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sha256)) {
    throw new Error('Audio version must be a complete SHA-256 byte hash');
  }
  if (typeof path !== 'string' || !/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.mp3$/.test(path)) {
    throw new Error(`Unsafe MP3 object key: ${String(path)}`);
  }
  return `${path.slice(0, -4)}--${sha256.toLowerCase()}.mp3`;
}
