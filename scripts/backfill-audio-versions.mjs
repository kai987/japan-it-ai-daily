import { resolve } from 'node:path';
import { synchronizeAudioFileVersions } from './audio-file-versions.mjs';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--check')) throw new Error('Usage: node scripts/backfill-audio-versions.mjs [--check]');
const check = args.includes('--check');
const result = synchronizeAudioFileVersions(resolve('public/audio/japanese'), { check });
console.log(`Audio byte versions: ${result.manifests} manifests, ${result.recordings} references, ${result.changed.length} ${check ? 'outdated' : 'updated'} manifests.`);
if (check && result.changed.length) {
  console.error(result.changed.join('\n'));
  process.exitCode = 1;
}
