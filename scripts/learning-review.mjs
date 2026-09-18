import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentDates, contentDirs, readContent } from './content-files.mjs';
import { makeLexicalKey } from './check-jlpt-history.mjs';
import { makeGrammarKey } from './check-grammar-history.mjs';

export const REVIEW_POLICY = { effectiveFrom: '2026-09-18', vocabularyTarget: 20, grammarTarget: 7 };
export const FREQUENCY_SCOPE = '日文日报正文、推荐理由及学习卡片（新学＋复习）；同一天和中日镜像只计一次。不含外链全文。';
const clean = (s = '') => s.normalize('NFKC').replace(/\*\*|`/g, '').replace(/\s+/gu, ' ').trim();
const escaped = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const dateOf = value => value instanceof Date ? value.toISOString().slice(0,10) : String(value).slice(0,10);
export function issueNumbers(dates) {
  return Object.fromEntries([...new Set(dates.map(dateOf))].sort().map((date, i) => [date, i + 1]));
}
export function frequencyFor(dates, totalDays, appearanceForms = new Map()) {
  const appearedDates = [...new Set(dates)].sort();
  if (!Number.isInteger(totalDays) || totalDays < 1 || appearedDates.length > totalDays) throw new Error('Invalid report-frequency denominator');
  const forms = Object.fromEntries(appearedDates.map(date => [date, appearanceForms.get(date)]).filter(([, form]) => typeof form === 'string' && form.length));
  const frequency = { appearedDays: appearedDates.length, totalDays, percent: Number((appearedDates.length / totalDays * 100).toFixed(1)), appearedDates };
  return Object.keys(forms).length ? { ...frequency, appearanceForms: forms } : frequency;
}
export function frequencyText(frequency, locale = 'zh') {
  return `${locale === 'ja' ? '出現頻度' : '出现频率'}：${frequency.percent.toFixed(1)}%（${frequency.appearedDays}/${frequency.totalDays}${locale === 'ja' ? '日' : '天'}）`;
}
function formsFor(card, kind, rules, key) {
  const label = kind === 'vocabulary' ? card.term : card.pattern;
  const id = key(label);
  const forms = new Set([id, clean(label).replace(/[~～〜…]/gu, '')]);
  for (const [form, target] of Object.entries(rules.aliases || {})) if (key(target) === id) forms.add(form);
  if (kind === 'vocabulary') {
    // サ変名詞の活用は名詞部分で照合。五段は長い語だけ、明示された活用語幹を使う。
    if (/する$/.test(label)) forms.add(label.slice(0, -2));
    const endings = { 'う':['い','わ','え','お','った','って'], 'く':['き','か','け','こ','いた','いて'], 'ぐ':['ぎ','が','げ','ご','いだ','いで'], 'す':['し','さ','せ','そ','した','して'], 'つ':['ち','た','て','と','った','って'], 'ぬ':['に','な','ね','の','んだ','んで'], 'ぶ':['び','ば','べ','ぼ','んだ','んで'], 'む':['み','ま','め','も','んだ','んで'], 'る':['り','ら','れ','ろ','った','って'] };
    if ((card.partOfSpeech || '').includes('五段') && label.length >= 4) for (const end of endings[label.at(-1)] || []) forms.add(label.slice(0,-1) + end);
  } else if (id === 'ために') {
    forms.add('ための'); // 目的を表す同じ文型の名詞修飾形
  }
  return [...forms].map(clean).filter(x => x.length >= 2).sort((a,b) => b.length - a.length);
}
function matcherFor(card, kind, rules, key) {
  const id = key(kind === 'vocabulary' ? card.term : card.pattern);
  const forms = formsFor(card, kind, rules, key);
  const patterns = forms.map(form => {
      let pattern = escaped(form);
      // Similar-looking, different-function grammar must not be merged.
      if (kind === 'grammar' && id === 'つつ') pattern += '(?!も|ある|あり|あっ)';
      if (kind === 'grammar' && id === 'わけではない') pattern = '(?<!ない)' + pattern;
      if (kind === 'grammar' && id === '上で') pattern = '(?<![ただ])' + pattern;
      if (kind === 'grammar' && id === 'に至る') pattern += '(?!まで)';
      if (kind === 'grammar' && id === 'かねる') pattern += '(?!ない)';
      return {form, regex:new RegExp(pattern,'u')};
  });
  return (text) => {
    const input = text; // All caller corpus chunks are normalized once when loaded.
    for (const {form,regex} of patterns) {
      if (!input.includes(form)) continue;
      const match = regex.exec(input);
      if (match) return { form: match[0], excerpt: input.length <= 280 ? input : '…' + input.slice(Math.max(0,match.index-65), Math.min(input.length,match.index+match[0].length+120)) + '…' };
    }
    return null;
  };
}
function corpusFor(files) {
  const ja = files['daily-ja'];
  // Ignore generated review material and Chinese translations, URLs and code.
  const prose = ja.body.split(/^#{1,2}\s+C[.．]\s*/m)[0]
    .replace(/```[\s\S]*?```/g,'').replace(/^#{1,6}[^\n]*$/gm,'').replace(/https?:\/\/\S+/g,'');
  const chunks = prose.split(/\n|(?<=。)/u).map(clean).filter(Boolean).map(text => ({text, sourceKind:'report-body'}));
  chunks.push(...(ja.data.top || []).map(item => ({text:clean(item.why || ''), sourceKind:'article-summary'})));
  for (const dir of ['japanese','japanese-ja']) for (const kind of ['vocabulary','grammar'])
    for (const item of files[dir].data[kind] || []) if (item.exampleJa) chunks.push({text:clean(item.exampleJa), sourceKind:'learning-example'});
  return chunks;
}
// Card text participates in document frequency, but cannot manufacture eligibility
// for a review: review candidates still need an occurrence in the original daily
// prose / recommendation / original learning examples above.
function cardTexts(card) {
  return [card.term,card.pattern,card.reading,card.meaning,card.structure,card.usage,card.note,card.nuance,card.exampleJa,card.exampleMeaning,...(card.collocations||[])].filter(value=>typeof value==='string' && value.trim()).map(clean);
}
function normalizedCard(card, locale, extra) {
  const out = { ...card, ...extra };
  if (locale === 'zh') {
    out.meaning = card.meaningZh; out.note = card.noteZh; out.nuance = card.nuanceZh;
    out.usage = card.usageZh; out.exampleMeaning = card.exampleZh;
  }
  return out;
}
export function buildStudyArchive(root = process.cwd()) {
  const dates = contentDates(root);
  if (!dates.length) throw new Error('No dated four-file reports');
  const numbers = issueNumbers(dates);
  const rules = {
    vocabulary: JSON.parse(readFileSync(join(root,'docs/jlpt-history/identity-rules.json'),'utf8')),
    grammar: JSON.parse(readFileSync(join(root,'docs/grammar-history/identity-rules.json'),'utf8')),
  };
  const keys = {vocabulary:makeLexicalKey(rules.vocabulary), grammar:makeGrammarKey(rules.grammar)};
  const days = dates.map(date => {
    const files = Object.fromEntries(contentDirs.map(dir => [dir,readContent(root,dir,date)]));
    const corpus=corpusFor(files);
    const cardCorpus=[...(files['japanese-ja'].data.vocabulary||[]),...(files['japanese-ja'].data.grammar||[])].flatMap(cardTexts).join('\n');
    return {date,files,corpus,corpusBlock:corpus.map(x=>x.text).join('\n'),cardCorpus};
  });
  const registries = {vocabulary:new Map(),grammar:new Map()};
  for (const day of days) for (const kind of ['vocabulary','grammar']) {
    const zh = day.files.japanese.data[kind], ja = day.files['japanese-ja'].data[kind];
    if (!Array.isArray(zh) || !Array.isArray(ja) || zh.length !== ja.length) throw new Error(`${day.date}: missing bilingual ${kind}`);
    zh.forEach((card,i) => {
      const id = keys[kind](card[kind==='vocabulary'?'term':'pattern']);
      if (id !== keys[kind](ja[i][kind==='vocabulary'?'term':'pattern'])) throw new Error(`${day.date}: mismatched identity`);
      if (registries[kind].has(id)) throw new Error(`${day.date}: repeated NEW ${kind}: ${id}`);
      registries[kind].set(id, {id,firstDate:day.date,zh:card,ja:ja[i],match:matcherFor(card,kind,rules[kind],keys[kind]),appearedDates:[],appearanceForms:new Map(),evidence:new Map()});
    });
  }
  for (const day of days) for (const kind of ['vocabulary','grammar']) {
    const introduced = new Set(day.files.japanese.data[kind].map(card => keys[kind](card[kind==='vocabulary'?'term':'pattern'])));
    for (const entry of registries[kind].values()) {
      let evidence;
      if (entry.match(day.corpusBlock)) for (const chunk of day.corpus) {
        const match = entry.match(chunk.text);
        if (match) { evidence = {...match, sourceKind:chunk.sourceKind}; break; }
      }
      if (evidence) entry.evidence.set(day.date,evidence);
      const cardOccurrence = entry.match(day.cardCorpus);
      if (introduced.has(entry.id) || evidence || cardOccurrence) {
        entry.appearedDates.push(day.date);
        entry.appearanceForms.set(day.date, evidence?.form || cardOccurrence?.form || clean(entry.ja[kind === 'vocabulary' ? 'term' : 'pattern']).replace(/[~～〜…]/gu, ''));
      }
    }
  }
  const result = {schemaVersion:1,policy:REVIEW_POLICY,frequencyScope:FREQUENCY_SCOPE,totalDays:dates.length,firstDate:dates[0],lastDate:dates.at(-1),issueNumbers:numbers,lessons:{}};
  for (const day of days) {
    const views = {zh:{},ja:{}};
    for (const kind of ['vocabulary','grammar']) {
      const field = kind==='vocabulary'?'term':'pattern';
      const original = day.files.japanese.data[kind];
      const currentIds = new Set(original.map(card => keys[kind](card[field])));
      const target = kind==='vocabulary'?REVIEW_POLICY.vocabularyTarget:REVIEW_POLICY.grammarTarget;
      const gap = day.date >= REVIEW_POLICY.effectiveFrom ? Math.max(0,target-original.length) : 0;
      const candidates = [...registries[kind].values()].filter(entry => entry.firstDate < day.date && !currentIds.has(entry.id) && entry.evidence.has(day.date));
      const priority = entry => ['N1','N2'].includes(entry.zh.level)?0:1;
      const countAtDate = entry => entry.appearedDates.filter(date=>date<=day.date).length;
      candidates.sort((a,b)=>priority(a)-priority(b) || countAtDate(b)-countAtDate(a) || a.firstDate.localeCompare(b.firstDate) || a.id.localeCompare(b.id,'ja'));
      const selected = candidates.slice(0,gap);
      for (const locale of ['zh','ja']) {
        views[locale][kind] = original.map((_,i) => {
          const card=day.files[locale==='zh'?'japanese':'japanese-ja'].data[kind][i],entry=registries[kind].get(keys[kind](card[field]));
          return normalizedCard(card,locale,{studyKind:'new',identity:entry.id,firstIntroducedDate:entry.firstDate,reportFrequency:frequencyFor(entry.appearedDates,dates.length,entry.appearanceForms)});
        });
        const reviewField = kind==='vocabulary'?'reviewVocabulary':'reviewGrammar';
        views[locale][reviewField] = selected.map(entry=>normalizedCard(entry[locale],locale,{
          studyKind:'review',identity:entry.id,firstIntroducedDate:entry.firstDate,
          reviewEvidence:entry.evidence.get(day.date),reportFrequency:frequencyFor(entry.appearedDates,dates.length,entry.appearanceForms),
        }));
        views[locale][kind==='vocabulary'?'studyVocabularyCount':'studyGrammarCount'] = original.length+selected.length;
        if (selected.length<gap) views[locale][kind==='vocabulary'?'reviewVocabularyNote':'reviewGrammarNote'] = locale==='ja'
          ? `本文で確認できる既習項目は${selected.length}件です。目標${target}件に足りない分を、本文にない表現や未習項目で埋めていません。`
          : `本文中可核对的既习项目只有${selected.length}项；不足${target}项的部分不使用未出现或尚未学过的内容凑数。`;
      }
    }
    result.lessons[day.date] = {date:day.date,issueNumber:numbers[day.date],...views};
  }
  // Freeze review selection first, then include visible review-card text in the
  // frequency corpus. One date is counted once; no recursive re-selection loop.
  for (const day of days) {
    const review = result.lessons[day.date].ja;
    const text = [...review.reviewVocabulary,...review.reviewGrammar].flatMap(cardTexts).join('\n');
    for (const kind of ['vocabulary','grammar']) for (const entry of registries[kind].values()) {
      if (entry.appearedDates.includes(day.date)) continue;
      const match = entry.match(text);
      if (match) {
        entry.appearedDates.push(day.date);
        entry.appearanceForms.set(day.date, match.form);
      }
    }
  }
  for (const day of Object.values(result.lessons)) for (const locale of ['zh','ja']) for (const kind of ['vocabulary','grammar'])
    for (const card of [...day[locale][kind],...day[locale][kind==='vocabulary'?'reviewVocabulary':'reviewGrammar']])
      card.reportFrequency = frequencyFor(registries[kind].get(card.identity).appearedDates,dates.length,registries[kind].get(card.identity).appearanceForms);
  return result;
}
let cached;
export const getStudyArchive = () => cached ??= buildStudyArchive();
export function getStudyDay(date, locale='zh') {
  const entry = getStudyArchive().lessons[dateOf(date)];
  if (!entry) throw new Error(`Unknown report date ${date}`);
  return {...entry[locale],issueNumber:entry.issueNumber};
}
export function titleWithIssue(title,date) {
  const number = getStudyArchive().issueNumbers[dateOf(date)];
  if (!number) throw new Error(`No issue number for ${date}`);
  return `${title.replace(/\s*[（(]第\d+号[）)]\s*$/u,'')}（第${number}号）`;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const archive=buildStudyArchive();
  if(process.argv.includes('--json')) console.log(JSON.stringify(archive));
  else {
    const day=archive.lessons[archive.lastDate];
    console.log(`Reports: ${archive.totalDays}. ${day.date} (#${day.issueNumber}): vocabulary ${day.zh.vocabulary.length} new + ${day.zh.reviewVocabulary.length} review; grammar ${day.zh.grammar.length} new + ${day.zh.reviewGrammar.length} review.`);
    console.log(day.zh.reviewVocabulary.map(x=>[x.term,x.reportFrequency,x.reviewEvidence]));
    console.log(day.zh.reviewGrammar.map(x=>[x.pattern,x.level,x.reportFrequency,x.reviewEvidence]));
  }
}
