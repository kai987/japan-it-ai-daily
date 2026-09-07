import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from 'vitest';
import { extractAnswers, extractReviewCards } from './interview';

test('all historical routes expose five shared answers and three shared review questions', () => {
  const dates = readdirSync('src/content/daily').filter((name) => name.endsWith('.md'));
  expect(dates.length).toBeGreaterThan(0);
  for (const name of dates) {
    const zh = readFileSync(`src/content/daily/${name}`, 'utf8');
    const ja = readFileSync(`src/content/daily-ja/${name}`, 'utf8');
    expect(extractAnswers(zh), name).toHaveLength(5);
    expect(extractAnswers(ja), name).toEqual(extractAnswers(zh));
    expect(extractReviewCards(zh), name).toHaveLength(3);
    expect(extractReviewCards(ja).map((card) => card.question), name).toEqual(extractReviewCards(zh).map((card) => card.question));
    expect(extractReviewCards(ja).every((card) => card.points.length > 0), name).toBe(true);
  }
});

test('nested topic headings and multiline answers do not swallow adjacent sections', () => {
  const body = '## 3. 面接で使えるポイント\n### 話題\n**約30秒の回答**\n\n> 第一文。\n> 第二文。\n## 4. 他の内容\n> 関係のない引用';
  expect(extractAnswers(body)).toEqual(['第一文。 第二文。']);
  expect(extractAnswers(body.replace('約30秒の回答', '30秒回答'))).toEqual(['第一文。 第二文。']);
  expect(extractReviewCards('### 面试复习卡\n- 質問 → 要点\n### 他の内容\n- 除外')).toEqual([{ question: '質問', points: '要点' }]);
});
