import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentDates, readContent } from './content-files.mjs';
import { EVIDENCE_FROM, validateEvidence } from './source-evidence.mjs';
const args = process.argv.slice(2);
const arg = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const root = process.cwd();
const pilot = arg('--pilot');
const requested = arg('--date');
const records = pilot ? [JSON.parse(readFileSync(pilot, 'utf8'))] : null;
const dates = records ? records.map((record) => record.date) : contentDates(root).filter((date) => date >= EVIDENCE_FROM && (!requested || date === requested));
if (!dates.length) {
  if (requested) throw new Error(`No eligible report for ${requested}`);
  console.log(`Evidence pilot enabled from ${EVIDENCE_FROM}; no new report exists yet (0 reviewed, historical reports unchanged).`);
} else {
  let failed = false;
  for (const [index, date] of dates.entries()) {
    try {
      const record = records?.[index] ?? JSON.parse(readFileSync(join(root, 'src/content/evidence', `${date}.json`), 'utf8'));
      const errors = validateEvidence(record, date, readContent(root, 'daily', date), readContent(root, 'daily-ja', date), arg('--source-dir'));
      errors.forEach((error) => console.error(error));
      if (errors.length) failed = true;
      console.log(`${date}: evidence ${errors.length ? 'FAIL' : 'PASS'} (${record.articles?.length || 0} articles; declared claims only${arg('--source-dir') ? '; captured source quotes checked' : '; source access is not re-checked in offline CI'})`);
    } catch (error) { failed = true; console.error(`${date}: ${error.message}`); }
  }
  if (failed) process.exit(1);
}
