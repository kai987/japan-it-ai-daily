// Identity is lexical, not sentence similarity. Homophones remain distinct.
// Extra editorial aliases are data, not executable rules.
export function createIdentity(config = {}, items = []) {
  const aliases = config.aliases || {};
  const adjectives = new Set(config.adjectiveStems || []);
  const suru = new Set(config.suruStems || []);
  const clean = (s) => String(s || '').normalize('NFKC').replace(/\s+/gu, '');
  for (const item of items) {
    const term = clean(item.term);
    const pos = String(item.partOfSpeech || '');
    if (/(な形容|形容動詞)/u.test(pos)) adjectives.add(term.replace(/[なに]$/u, ''));
    if (/サ変/u.test(pos) && term.endsWith('する')) suru.add(term.slice(0, -2));
  }
  return (item) => {
    let term = clean(typeof item === 'string' ? item : item.term);
    if (/[なに]$/u.test(term) && adjectives.has(term.slice(0, -1))) term = term.slice(0, -1);
    if (term.endsWith('する') && suru.has(term.slice(0, -2))) term = term.slice(0, -2);
    return aliases[term] || term;
  };
}

export function auditVocabularyHistory(days, config = {}) {
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const dates = new Set();
  const identity = createIdentity(config, ordered.flatMap((d) => d.vocabulary));
  const first = new Map();
  const duplicates = [];
  for (const day of ordered) {
    if (dates.has(day.date)) throw new Error(`Duplicate history date: ${day.date}`);
    dates.add(day.date);
    if (!Array.isArray(day.vocabulary)) throw new Error(`Missing vocabulary: ${day.date}`);
    for (const word of day.vocabulary) {
      const key = identity(word);
      if (!key) throw new Error(`Empty vocabulary identity: ${day.date}`);
      if (first.has(key)) duplicates.push({ date: day.date, term: word.term, identity: key, firstDate: first.get(key).date, firstTerm: first.get(key).term });
      else first.set(key, { date: day.date, term: word.term });
    }
  }
  return { dates: dates.size, unique: first.size, duplicates };
}
