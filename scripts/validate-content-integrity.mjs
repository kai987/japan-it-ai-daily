import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentDirs, contentDates, readContent } from './content-files.mjs';

export const validateContentDay = (date, documents) => {
  const errors = [];
  const require = (ok, message) => { if (!ok) errors.push(`${date}: ${message}`); };
  const array = (value) => Array.isArray(value) ? value : [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const unique = (values) => new Set(values).size === values.length;
  const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
  for (const dir of contentDirs) {
    const data = documents[dir];
    require(Boolean(data), `${dir} missing`);
    if (!data) continue;
    const parsedDate = new Date(data.date);
    require(Number.isFinite(parsedDate.valueOf()) && parsedDate.toISOString().slice(0, 10) === date, `${dir} frontmatter date differs from filename`);
    require(nonempty(data.title) && nonempty(data.description), `${dir} title/description missing`);
    if (dir.startsWith('daily')) {
      const top = array(data.top);
      require(top.length === 5, `${dir} must have exactly five Top items`);
      require(unique(top.map((item) => item.url)), `${dir} duplicate Top URL`);
      top.forEach((item, index) => {
        for (const field of ['title', 'source', 'topic', 'url']) require(nonempty(item[field]), `${dir} Top ${index + 1} missing ${field}`);
        try { require(['https:', 'http:'].includes(new URL(item.url).protocol), `${dir} invalid Top URL`); }
        catch { require(false, `${dir} invalid Top URL`); }
      });
    } else {
      const vocabulary = array(data.vocabulary), grammar = array(data.grammar), technical = array(data.technicalTerms);
      require(data.vocabularyCount === vocabulary.length, `${dir} vocabularyCount differs from vocabulary.length`);
      require(data.grammarCount === grammar.length, `${dir} grammarCount differs from grammar.length`);
      require(vocabulary.length >= 18 && vocabulary.length <= 22, `${dir} vocabulary must contain 18–22 items`);
      require(grammar.length >= 5 && grammar.length <= 8, `${dir} grammar must contain 5–8 items`);
      require(technical.length >= 5 && technical.length <= 10, `${dir} technicalTerms must contain 5–10 items`);
      for (const [key, items, field, count] of [['mustRememberWords', vocabulary, 'term', 10], ['mustRememberGrammar', grammar, 'pattern', 5]]) {
        const selected = array(data[key]);
        require(selected.length === count && unique(selected), `${dir} ${key} must contain ${count} unique items`);
        require(selected.every((value) => items.some((item) => item[field] === value)), `${dir} ${key} contains an unknown item`);
      }
      for (const [items, key] of [[vocabulary, 'term'], [grammar, 'pattern'], [technical, 'term']]) {
        require(items.every((item) => nonempty(item[key])) && unique(items.map((item) => item[key])), `${dir} duplicate or empty ${key}`);
      }
    }
  }
  const zh = documents.daily, ja = documents['daily-ja'];
  if (zh && ja) {
    // Display titles and prose are independently localized, never exact-matched.
    for (const field of ['source', 'topic', 'url', 'articleId', 'originalTitle']) {
      require(same(array(zh.top).map((item) => item[field] ?? null), array(ja.top).map((item) => item[field] ?? null)), `Top ${field} identity/order differs between languages`);
    }
  }
  const zl = documents.japanese, jl = documents['japanese-ja'];
  if (zl && jl) {
    for (const [key, fields] of [['vocabulary', ['term', 'reading', 'level']], ['grammar', ['pattern', 'level']], ['technicalTerms', ['term', 'japanese']]]) {
      require(same(array(zl[key]).map((item) => fields.map((field) => item[field] ?? null)), array(jl[key]).map((item) => fields.map((field) => item[field] ?? null))), `${key} identity/order differs between languages`);
    }
    for (const key of ['mustRememberWords', 'mustRememberGrammar']) require(same(zl[key], jl[key]), `${key} differs between languages`);
  }
  return errors;
};

export const validateContent = (root) => {
  const dates = contentDates(root);
  if (!dates.length) throw new Error('No content dates to validate');
  const errors = dates.flatMap((date) => {
    const documents = {}, failures = [];
    for (const dir of contentDirs) {
      try { documents[dir] = readContent(root, dir, date).data; }
      catch (error) { failures.push(error.message); }
    }
    return [...failures, ...validateContentDay(date, documents)];
  });
  return { dates: dates.length, errors };
};
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { dates, errors } = validateContent(process.cwd());
  errors.forEach((error) => console.error(error));
  console.log(`Content integrity: ${dates} four-file sets, ${errors.length} error(s).`);
  if (errors.length) process.exit(1);
}
