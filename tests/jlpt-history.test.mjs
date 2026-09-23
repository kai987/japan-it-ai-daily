import { describe, expect, it } from 'vitest';
import { c1Terms } from '../scripts/check-jlpt-history.mjs';

describe('daily C-1 vocabulary parsing', () => {
  it('accepts a kana-only term without redundant reading parentheses', () => {
    const body = `## C-1. 新規語彙\n1. **悪意（あくい）｜N1**：害意。\n2. **とどまる｜N1**：範囲を超えない。\n\n## C-2. IT用語\n`;
    expect(c1Terms(body)).toEqual(['悪意', 'とどまる']);
  });

  it('still extracts the canonical term before furigana', () => {
    const body = `## C-1. JLPT词汇\n1. **書き換える（かきかえる）｜N2**：改写。\n\n## C-2. IT用語\n`;
    expect(c1Terms(body)).toEqual(['書き換える']);
  });
});
