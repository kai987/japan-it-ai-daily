import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeGrammarKey,checkGrammarDays,checkGrammarHistory,dailyGrammarPatterns,dailyMustGrammar } from '../../scripts/check-grammar-history.mjs';
import { grammarRecordingFiles } from '../../scripts/verify-audio-integrity.mjs';
const key=makeGrammarKey(JSON.parse(readFileSync(new URL('../../docs/grammar-history/identity-rules.json',import.meta.url),'utf8')));
const day=(date,patterns,must=patterns)=>({date,grammar:patterns.map(pattern=>({pattern})),mustRememberGrammar:must,grammarSelectionNote:'全履歴と原文を照合した結果、未収録の文型だけを採用しています。'});
describe('full-history grammar and playback integrity',()=>{
 it('normalizes typography and reviewed variants',()=>{
  for(const [a,b] of [['～た上で','〜たうえで'],['～に伴い','に伴って'],['～に基づく','～に基づいて'],['～に過ぎない','にすぎません'],['～における','～において']])expect(key(a)).toBe(key(b));
 });
 it('preserves distinct grammar functions',()=>{
  for(const [a,b] of [['～する上で','～した上で'],['～にかかわらず','～にもかかわらず'],['～つつ','～つつも'],['～たところ','～たところで'],['～かねる','～かねない'],['～わけではない','～ないわけではない']])expect(key(a)).not.toBe(key(b));
 });
 it('rejects distant and same-day repeats, even with different examples',()=>{
  expect(()=>checkGrammarDays([day('01',['～た上で']),day('02',['～ものの']),day('03',['～たうえで'])],key)).toThrow(/already introduced on 01/);
  expect(()=>checkGrammarDays([day('01',['～に伴い','～に伴って'])],key)).toThrow(/same-day/);
 });
 it('fails closed on missing history, malformed selections and unexplained shortage',()=>{
  expect(()=>checkGrammarDays([],key)).toThrow(/No grammar history/);
  expect(()=>checkGrammarDays([day('01',['～ものの'],['～別物'])],key)).toThrow(/subset/);
  expect(()=>checkGrammarDays([{...day('01',[]),grammarSelectionNote:''}],key)).toThrow(/selection note/);
  expect(checkGrammarDays([day('01',[])],key).grammar).toBe(0);
 });
 it('reads actual content rather than a cached migration report',()=>{
  const r=checkGrammarHistory(process.cwd());expect(r.dates).toBeGreaterThanOrEqual(37);expect(r.grammar).toBeGreaterThanOrEqual(73);expect(r.duplicates).toBe(0);
 });
 it('parses both card and compact daily formats',()=>{
  expect(dailyGrammarPatterns('## C-3. 文法\n1. **～ものの｜N2**：例\n## C-4. 必修\n')).toEqual(['～ものの']);
  expect(dailyMustGrammar('## C-4. 必修\n**1文法：** ～ものの')).toEqual(['～ものの']);
 });
 it('never treats browser speech as a recording or ignores missing audio',()=>{
  const item={pattern:'～ものの',exampleJa:'確認したものの不明です。',example:null,playback:'browser-tts',reason:'historical-grammar-repair'};
  expect(grammarRecordingFiles([item],'test')).toEqual([]);
  expect(()=>grammarRecordingFiles([{...item,example:'old.mp3'}],'test')).toThrow();
  expect(()=>grammarRecordingFiles([{pattern:'～ものの',exampleJa:'例',example:null}],'test')).toThrow();
  expect(()=>grammarRecordingFiles([{...item,exampleHash:'stale'}],'test')).toThrow();
 });
});
