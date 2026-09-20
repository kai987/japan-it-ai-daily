import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// An empty/missing directory is optional audio; a partial generation is damage.
export function audioManifestState(root, date) {
  const directory = join(root, 'public/audio/japanese', date);
  const names = ['manifest.json', 'interview-manifest.json'];
  const present = names.map((name) => existsSync(join(directory, name)));
  if (present.every(Boolean)) return 'ready';
  const recordings = existsSync(directory) && readdirSync(directory).some((name) => name.endsWith('.mp3'));
  if (present.every((value) => !value) && !recordings) return 'pending';
  throw new Error(`${date}: incomplete audio generation; missing ${names.filter((_, index) => !present[index]).join(', ')}`);
}
