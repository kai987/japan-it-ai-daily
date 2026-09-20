import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { validateStructuredInterview } from '../src/lib/structuredInterview.mjs';

const validDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
  && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;

export function structuredInterviewPolicy(root = process.cwd()) {
  const policy = JSON.parse(readFileSync(join(root, 'docs/structured-interview-policy.json'), 'utf8'));
  if (policy.schemaVersion !== 1 || !Array.isArray(policy.requiredDates)
    || policy.requiredDates.some(date => !validDate(date))
    || (policy.requiredFrom !== undefined && !validDate(policy.requiredFrom))
    || new Set(policy.requiredDates).size !== policy.requiredDates.length) throw new Error('Invalid structured interview policy');
  return policy;
}
export const requiresStructuredInterview = (date, policy) => policy.requiredDates.includes(date)
  || (policy.requiredFrom !== undefined && date >= policy.requiredFrom);

export function structuredInterviewDates(root = process.cwd()) {
  const policy = structuredInterviewPolicy(root);
  const required = [...policy.requiredDates];
  // Every new report must opt in automatically; missing a JSON file must not
  // make a newly published date disappear from validation.
  if (policy.requiredFrom) {
    for (const dir of ['daily', 'daily-ja']) {
      required.push(...readdirSync(join(root, 'src/content', dir))
        .filter(name => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
        .map(name => name.slice(0, 10)).filter(date => date >= policy.requiredFrom));
    }
  }
  const present = readdirSync(join(root, 'src/data/interviews')).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).map(name => name.slice(0, 10));
  return [...new Set([...required, ...present])].sort();
}

/** Build/authoring-time only. Never import this filesystem reader into client scripts.
 * @returns {import('../src/lib/structuredInterview.mjs').StructuredInterview | null}
 */
export function readStructuredInterview(date, root = process.cwd()) {
  if (!validDate(date)) throw new Error('Invalid interview date');
  const required = requiresStructuredInterview(date, structuredInterviewPolicy(root));
  let source;
  try { source = readFileSync(join(root, 'src/data/interviews', `${date}.json`), 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT' && !required) return null;
    throw new Error(`${date}: structured interview unavailable (${error.message})`);
  }
  // Corrupt/invalid migrated data must fail, never silently fall back to Markdown.
  return validateStructuredInterview(JSON.parse(source), date);
}

export function readStructuredInterviewFromSource(source, root = process.cwd()) {
  const header = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!header) return null;
  const date = parse(header[1])?.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return readStructuredInterview(date, root);
}
