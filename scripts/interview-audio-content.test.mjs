import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import { parseInterview } from './interview-audio-content.mjs';
import { extractAnswers } from '../src/lib/interview';

test('audio roles and answer text match the website for every supported date', () => {
  for (const name of readdirSync('src/content/daily').filter((name) => name >= '2026-08-12.md' && name.endsWith('.md'))) {
    const source = readFileSync(`src/content/daily/${name}`, 'utf8');
    const items = parseInterview(source);
    const japanese = readFileSync(`src/content/daily-ja/${name}`, 'utf8');
    expect(parseInterview(japanese), name).toEqual(items);
    expect(items.map((item) => item.type), name).toEqual(Array.from({ length: 5 }, () => ['question', 'answer']).flat());
    expect(items.filter((item) => item.type === 'answer').map((item) => item.text), name).toEqual(extractAnswers(source));
  }
});

test.each(['约30秒回答', '约30秒日语回答', '約30秒日本語回答', '約30秒の回答', '30秒回答'])(
  'recognizes answer label %s without reusing the question role', (label) => {
    const source = `## 3. 面接で使えるポイント\n**面试问题：**\n> 質問ですか。\n\n**${label}：**\n> 第一文。\n> 第二文。\n`;
    expect(parseInterview(source)).toEqual([{ type: 'question', text: '質問ですか。' }, { type: 'answer', text: '第一文。 第二文。' }]);
  },
);

test('plain and quoted bilingual question labels preserve question and answer boundaries', () => {
  for (const question of ['面试问题', '面接質問', '質問']) {
    const plain = `## 3. 面接で使えるポイント\n**${question}：**\n\n質問ですか。\n\n**約30秒回答：**\n\n回答です。\n\n**キーワード：**\n除外\n`;
    expect(parseInterview(plain)).toEqual([{ type: 'question', text: '質問ですか。' }, { type: 'answer', text: '回答です。' }]);
  }
});
