import { describe, expect, it } from 'vitest';
import { dailyGrammarPatterns, dailyMustGrammar } from '../scripts/check-grammar-history.mjs';

describe('daily grammar representation parsing', () => {
  it('strips display-only JLPT levels from C-3 headings', () => {
    const body = `## C-3. 新学语法3项\n### 1. ～ことを受けて｜N2\n本文。\n### 2. ～得る（うる／える）｜N2\n本文。\n### 3. ～ようにする｜N3\n本文。\n\n## C-4. 今日必须记住\n`;
    expect(dailyGrammarPatterns(body)).toEqual(['～ことを受けて', '～得る（うる／える）', '～ようにする']);
  });

  it('parses the Chinese localized C-4 grammar label', () => {
    const body = `## C-4. 今日必须记住\n**新语法3个：** ～ことを受けて／～得る（うる／える）／～ようにする\n`;
    expect(dailyMustGrammar(body)).toEqual(['～ことを受けて', '～得る（うる／える）', '～ようにする']);
  });

  it('parses the simplified Chinese 项 counter in C-4 grammar labels', () => {
    const body = `## C-4. 今日必背\n- **新语法3项：** ～なければならない / ～ことこそ / ～に満たない\n`;
    expect(dailyMustGrammar(body)).toEqual(['～なければならない', '～ことこそ', '～に満たない']);
  });

  it('parses the Japanese localized C-4 grammar label', () => {
    const body = `## C-4. 今日必ず覚える項目\n**新規文法：** ～ことを受けて／～得る（うる／える）／～ようにする\n`;
    expect(dailyMustGrammar(body)).toEqual(['～ことを受けて', '～得る（うる／える）', '～ようにする']);
  });
});
