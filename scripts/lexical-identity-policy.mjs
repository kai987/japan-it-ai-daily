import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function makeLexicalKey(rules) {
  const aliases = rules.aliases || {}, stems = new Set(rules.naStems || []);
  return (value) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Empty vocabulary identity');
    let term = value.normalize('NFKC').replace(/[\s\u200b\ufeff]+/gu, '');
    term = aliases[term] || term;
    if (term.endsWith('する')) term = term.slice(0, -2);
    if (/[なに]$/.test(term) && (stems.has(term.slice(0, -1)) || term.slice(-2, -1) === '的')) term = term.slice(0, -1);
    return aliases[term] || term;
  };
}

const stablePayload = (value) => Array.isArray(value)
  ? value.map(stablePayload)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stablePayload(value[key])]))
    : value;

// Hash complete parsed cards, including translations, readings, examples and notes.
// Object field ordering is not card content; array order and every value are preserved.
export function vocabularyCardHash(card) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) throw new Error('Invalid vocabulary card payload');
  return createHash('sha256').update(JSON.stringify(stablePayload(card))).digest('hex');
}

const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const validDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const fail = (message) => { throw new Error(`Historical vocabulary policy: ${message}`); };

export function validateLexicalIdentityPolicy(policy) {
  if (policy?.schemaVersion !== 1 || policy.effectiveFrom !== '2026-11-02') fail('unsupported schema or effective date');
  if (!policy.aliasAdditions || typeof policy.aliasAdditions !== 'object' || Array.isArray(policy.aliasAdditions)) fail('missing alias additions');
  const aliases = Object.entries(policy.aliasAdditions);
  if (aliases.length !== 8 || aliases.some(([form, target]) => !nonempty(form) || !nonempty(target) || form === target)) fail('expected eight explicit aliases');
  if (!Array.isArray(policy.groups) || policy.groups.length !== 7) fail('expected seven reviewed groups');
  const identities = new Set(), occurrences = new Set(), legacyIdentities = new Set(), forms = new Set();
  for (const group of policy.groups) {
    if (!nonempty(group.lexicalIdentity) || identities.has(group.lexicalIdentity)) fail('invalid or repeated canonical identity');
    identities.add(group.lexicalIdentity);
    if (!validDate(group.firstIntroducedDate) || group.firstIntroducedDate >= policy.effectiveFrom) fail('invalid first introduction');
    if (!Array.isArray(group.occurrences) || group.occurrences.length !== 2) fail(`${group.lexicalIdentity}: expected exactly two originals`);
    let previous;
    for (const occurrence of group.occurrences) {
      if (!validDate(occurrence.date) || occurrence.date >= policy.effectiveFrom || previous && occurrence.date <= previous) fail(`${group.lexicalIdentity}: invalid occurrence date`);
      previous = occurrence.date;
      if (!nonempty(occurrence.term) || !nonempty(occurrence.legacyIdentity)) fail(`${group.lexicalIdentity}: missing original identity`);
      const occurrenceId = `${occurrence.date}\0${occurrence.term}`;
      if (occurrences.has(occurrenceId) || legacyIdentities.has(occurrence.legacyIdentity)) fail('repeated historical occurrence or legacy identity');
      occurrences.add(occurrenceId); legacyIdentities.add(occurrence.legacyIdentity); forms.add(occurrence.term);
      if (!['zh', 'ja'].every((locale) => /^[a-f0-9]{64}$/.test(occurrence.cardSha256?.[locale] || ''))) fail(`${occurrenceId}: missing bilingual card hashes`);
    }
    if (group.occurrences[0].date !== group.firstIntroducedDate) fail(`${group.lexicalIdentity}: wrong first introduction`);
  }
  if (new Set(aliases.map(([, target]) => target)).size !== 7 || aliases.some(([form, target]) => !forms.has(form) || !identities.has(target))) fail('aliases must cover exactly the seven reviewed groups');
  return policy;
}

export function historicalVocabularyRules(rules, policy) {
  validateLexicalIdentityPolicy(policy);
  const aliases = { ...rules.aliases };
  for (const [form, target] of Object.entries(policy.aliasAdditions)) {
    if (aliases[form] !== target) fail(`alias ${form} no longer matches the reviewed addition`);
    delete aliases[form];
  }
  return { ...rules, aliases };
}

export function loadLexicalIdentityPolicy(root, rules) {
  const policy = validateLexicalIdentityPolicy(JSON.parse(readFileSync(join(root, 'docs/jlpt-history/historical-variants.json'), 'utf8')));
  const canonicalKey = makeLexicalKey(rules), legacyKey = makeLexicalKey(historicalVocabularyRules(rules, policy));
  for (const group of policy.groups) for (const occurrence of group.occurrences) {
    if (canonicalKey(occurrence.term) !== group.lexicalIdentity) fail(`${occurrence.term}: wrong canonical identity`);
    if (legacyKey(occurrence.term) !== occurrence.legacyIdentity) fail(`${occurrence.term}: wrong legacy identity`);
  }
  return policy;
}
