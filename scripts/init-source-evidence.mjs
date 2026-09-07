import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { createEvidenceDraft } from './source-evidence.mjs';
import { readContent } from './content-files.mjs';
const args = process.argv.slice(2);
const arg = (name) => args[args.indexOf(name) + 1];
const date = args.includes('--date') ? arg('--date') : '';
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Use --date YYYY-MM-DD');
const context = args.includes('--context') ? JSON.parse(readFileSync(arg('--context'), 'utf8')) : readContent(process.cwd(), 'daily', date).data;
if (context.date && new Date(context.date).toISOString().slice(0, 10) !== date) throw new Error('Context date mismatch');
if (context.top?.length !== 5) throw new Error('Select exactly five original articles first');
const output = resolve(args.includes('--output') ? arg('--output') : join('src/content/evidence', `${date}.json`));
mkdirSync(dirname(output), { recursive: true });
// Never overwrite an existing draft or a reviewed record.
writeFileSync(output, JSON.stringify(createEvidenceDraft(date, context.top), null, 2) + '\n', { flag: 'wx' });
console.log(`Created DRAFT ${output}; review original sources and fill claims before publication.`);
