import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentDates, contentDirs, readContent } from './content-files.mjs';

export function makeGrammarKey(rules) {
  return (pattern) => {
    if (typeof pattern !== 'string' || !pattern.trim()) throw new Error('Empty grammar identity');
    const key = pattern.normalize('NFKC').replace(/[\s\u200b\ufeff~～〜…]/gu, '');
    return rules.aliases?.[key] || key;
  };
}
export function checkGrammarDays(days, key) {
  if (!days.length) throw new Error('No grammar history loaded');
  const seen = new Map(), sorted = [...days].sort((a,b) => a.date.localeCompare(b.date));
  if (new Set(sorted.map(d => d.date)).size !== sorted.length) throw new Error('Duplicate history date');
  for (const day of sorted) {
    if (!Array.isArray(day.grammar) || !Array.isArray(day.mustRememberGrammar)) throw new Error(`${day.date}: missing grammar arrays`);
    if (day.grammar.length < 5 && (typeof day.grammarSelectionNote !== 'string' || day.grammarSelectionNote.trim().length < 20)) throw new Error(`${day.date}: insufficient grammar requires selection note`);
    const current = new Set();
    for (const item of day.grammar) {
      const id = key(item.pattern);
      if (current.has(id)) throw new Error(`${day.date}: same-day grammar duplicate ${item.pattern}`);
      if (seen.has(id)) throw new Error(`${day.date}: grammar ${item.pattern} already introduced on ${seen.get(id)}`);
      current.add(id); seen.set(id, day.date);
    }
    const selected = day.mustRememberGrammar.map(key);
    if (selected.length !== Math.min(5,day.grammar.length) || new Set(selected).size !== selected.length || selected.some(x=>!current.has(x))) throw new Error(`${day.date}: invalid C4 grammar subset`);
  }
  return { dates: sorted.length, grammar: seen.size, duplicates: 0 };
}
const same=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(`${label}: grammar representation mismatch`);};
export function dailyGrammarPatterns(body) {
  const section = body.match(/^## C-3[^\n]*\n([\s\S]*?)(?=^## C-4\b)/m)?.[1];
  if (section === undefined) throw new Error('Missing C3 grammar section');
  const headings = [...section.matchAll(/^### (?:C-3-)?\d+\.\s+([^\n]+)/gm)].map(m=>m[1].trim());
  if (headings.length) return headings;
  return [...section.matchAll(/^\d+\.\s+\*\*([^｜|\n]+)[｜|]/gm)].map(m=>m[1].trim());
}
export function dailyMustGrammar(body) {
  const section = body.match(/^## C-4[^\n]*\n([\s\S]*)/m)?.[1];
  if (section === undefined) throw new Error('Missing C4 grammar section');
  const line = section.match(/^(?:- )?\*\*(\d+)\s*(?:文法|语法|語法)[：:]\*\*\s*([^\n]*)/m);
  if (line) return Number(line[1]) === 0 ? [] : line[2].replace(/`/g,'').split(/・|\s+\/\s+/).map(x=>x.trim());
  const legacy = section.match(/### \d+ 个重点语法\s*\n([\s\S]*?)(?=###|$)/)?.[1];
  if (legacy) return [...legacy.matchAll(/^(?:\d+\.|-)\s+(.+)/gm)].map(m=>m[1].replace(/\*\*|`/g,'').trim());
  throw new Error('Unrecognized C4 grammar selection');
}
export function checkGrammarHistory(root) {
  const rules = JSON.parse(readFileSync(join(root,'docs/grammar-history/identity-rules.json'),'utf8'));
  const key = makeGrammarKey(rules), dates=contentDates(root), days=[];
  for(const date of dates) {
    const files=Object.fromEntries(contentDirs.map(dir=>[dir,readContent(root,dir,date)]));
    const zh=files.japanese.data,ja=files['japanese-ja'].data;
    if(!Array.isArray(zh.grammar)||!Array.isArray(ja.grammar)) throw new Error(`${date}: missing grammar`);
    same(zh.grammar.map(x=>[x.pattern,x.level,x.exampleJa]),ja.grammar.map(x=>[x.pattern,x.level,x.exampleJa]),date);
    same(zh.mustRememberGrammar,ja.mustRememberGrammar,`${date} C4`);
    if(zh.grammarCount!==zh.grammar.length||ja.grammarCount!==ja.grammar.length)throw new Error(`${date}: incorrect grammarCount`);
    for(const dir of ['daily','daily-ja']) {
      same(dailyGrammarPatterns(files[dir].body),zh.grammar.map(x=>x.pattern),`${date}/${dir} C3`);
      same(dailyMustGrammar(files[dir].body),zh.mustRememberGrammar,`${date}/${dir} C4`);
    }
    if(date>'2026-09-17') for(const g of zh.grammar) {
      if(!files.daily.data.top.some(a=>a.url===g.sourceUrl)||typeof g.sourceForm!=='string'||!g.sourceForm.trim()||typeof g.sourceAnchor!=='string'||g.sourceAnchor.trim().length<10)throw new Error(`${date}: missing original-source grammar provenance for ${g.pattern}`);
    }
    days.push({date,grammar:zh.grammar,mustRememberGrammar:zh.mustRememberGrammar,grammarSelectionNote:zh.grammarSelectionNote});
  }
  return checkGrammarDays(days,key);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const r=checkGrammarHistory(process.cwd());console.log(`Grammar history: ${r.dates} full four-file dates; ${r.grammar} unique identities; ${r.duplicates} duplicates.`);
}
