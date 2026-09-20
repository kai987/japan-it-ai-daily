import { readFileSync, mkdirSync, readdirSync } from 'node:fs';
import { stageChangedAudio } from './audio-publication.mjs';

const value = (flag) => {
  const index = process.argv.indexOf(flag);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`${flag} is required`);
  return process.argv[index + 1];
};
const staging = value('--staging');
mkdirSync(staging, { recursive: true });
if (readdirSync(staging).length) throw new Error('Audio staging directory must be empty');
const changed = readFileSync(value('--changed-file'), 'utf8').split('\0').filter(Boolean);
console.log(`Staged ${stageChangedAudio(changed, staging)} legacy, immutable, and manifest object(s).`);
