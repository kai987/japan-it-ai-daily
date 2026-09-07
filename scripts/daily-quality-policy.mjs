import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

export const policy = JSON.parse(readFileSync(new URL('../docs/daily-quality-policy.json', import.meta.url), 'utf8'));

export const referenceMatches = (root, prefixes) => prefixes.every((prefix) => {
  const entries = Object.entries(policy.files).filter(([path]) => path.startsWith(`${prefix}/`));
  return entries.length > 0 && entries.every(([path, expected]) => {
    try {
      return createHash('sha256').update(readFileSync(join(root, path))).digest('hex') === expected;
    } catch { return false; }
  });
});
