import { describe, expect, it } from 'vitest';
import { c1Terms, c4Words } from '../scripts/check-jlpt-history.mjs';

describe('daily learning-card parsing', () => {
  it('accepts a kana-only C-1 term without redundant reading parentheses', () => {
    const body = `## C-1. 新規語彙\n1. **悪意（あくい）｜N1**：害意。\n2. **とどまる｜N1**：範囲を超えない。\n\n## C-2. IT用語\n`;
    expect(c1Terms(body)).toEqual(['悪意', 'とどまる']);
  });

  it('still extracts the canonical C-1 term before furigana', () => {
    const body = `## C-1. JLPT词汇\n1. **書き換える（かきかえる）｜N2**：改写。\n\n## C-2. IT用語\n`;
    expect(c1Terms(body)).toEqual(['書き換える']);
  });

  it('parses the Chinese localized C-4 label and full-width slash separators', () => {
    const body = `## C-4. 今日必须记住\n**新词10个：** 悪意／諮問／未解決\n**新语法3个：** ～ことを受けて／～得る／～ようにする\n`;
    expect(c4Words(body)).toEqual(['悪意', '諮問', '未解決']);
  });

  it('parses the Japanese localized C-4 label', () => {
    const body = `## C-4. 今日必ず覚える項目\n**新規語彙：** 悪意／諮問／未解決\n**新規文法：** ～ことを受けて／～得る／～ようにする\n`;
    expect(c4Words(body)).toEqual(['悪意', '諮問', '未解決']);
  });
});
