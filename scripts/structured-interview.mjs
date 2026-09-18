import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { validateStructuredInterview } from '../src/lib/structuredInterview.mjs';

export function structuredInterviewPolicy(root = process.cwd()) {
  const policy = JSON.parse(readFileSync(join(root, 'docs/structured-interview-policy.json'), 'utf8'));
  if (policy.schemaVersion !== 1 || !Array.isArray(policy.requiredDates)
    || policy.requiredDates.some(date => typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    || new Set(policy.requiredDates).size !== policy.requiredDates.length) throw new Error('Invalid structured interview policy');
  return policy;
}
export function structuredInterviewDates(root = process.cwd()) {
  const required = structuredInterviewPolicy(root).requiredDates;
  const present = readdirSync(join(root, 'src/data/interviews')).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).map(name => name.slice(0, 10));
  return [...new Set([...required, ...present])].sort();
}

/** Build/authoring-time only. Never import this filesystem reader into client scripts.
 * @returns {import('../src/lib/structuredInterview.mjs').StructuredInterview | null}
 */
export function readStructuredInterview(date, root = process.cwd()) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid interview date');
  const required = structuredInterviewPolicy(root).requiredDates.includes(date);
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
