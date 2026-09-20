import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Serve only local bytes that match the immutable media URL under test. */
export async function readImmutableAudioFixture(url) {
  const match = new URL(url).pathname.match(/\/japanese\/(\d{4}-\d{2}-\d{2}\/[A-Za-z0-9_-]+)--([a-f0-9]{64})\.mp3$/);
  if (!match) throw new Error(`Unexpected immutable audio URL: ${url}`);
  const bytes = await readFile(resolve('public/audio/japanese', `${match[1]}.mp3`));
  if (createHash('sha256').update(bytes).digest('hex') !== match[2]) throw new Error(`Audio fixture byte version mismatch: ${url}`);
  return bytes;
}
