import { expect, test } from 'vitest';
import { parseReview } from './interview-audio-content.mjs';
import { extractReviewCards } from '../src/lib/interview';

const questions = [
  'Claude CodeのMCP起動待ちを0にすれば常に速くなりますか。',
  'RAGの差分更新でURLをIDにする場合、どんな更新を取りこぼしますか。',
  'Agentic SOCでHuman Approvalを残すべき箇所はどこですか。',
];
const labels = ['**Q%d：**', '**Q%d**:', '**Q %d:**', '**q%d：**'];

for (const title of ['面试复习卡', '面接復習カード']) {
  for (const label of labels) {
    for (const eol of ['\n', '\r\n']) {
      test(`${title}: ${label} / ${JSON.stringify(eol)} preserves all three questions and excludes hints`, () => {
        const body = [
          '## 4. Other section', '**Q9：** 対象外の質問ですか。',
          `## 5. ${title}`,
          ...questions.flatMap((question, i) => [
            `${label.replace('%d', String(i + 1))} ${question}  `,
            `**回答要点：** 要点${i + 1} / 検証`, '',
          ]),
          '# B. Summary', '**Q4：** 次のセクションは除外しますか。',
        ].join(eol);
        const cards = extractReviewCards(body);
        expect(cards).toEqual(questions.map((question, i) => ({ question, points: `要点${i + 1} / 検証` })));
        expect(parseReview(body)).toEqual(questions);
        expect(parseReview(body)).toEqual(cards.map((card) => card.question));
      });
    }
  }
}

test('an empty bold Q label cannot turn the following answer hint into a question', () => {
  const body = '## 5. 面试复习卡\n**Q1：**\n回答要点：答えを質問として読み上げない\n';
  expect(extractReviewCards(body)).toEqual([]);
  expect(parseReview(body)).toEqual([]);
});

test('inline bold labels can coexist with existing plain heading blocks', () => {
  const body = '## 5. 面接復習カード\n**Q1：** 何を検証しますか。\n回答要点：条件\n\n### Q2\n何を記録しますか。\n回答ポイント：結果\n';
  const cards = [{ question: '何を検証しますか。', points: '条件' }, { question: '何を記録しますか。', points: '結果' }];
  expect(extractReviewCards(body)).toEqual(cards);
  expect(parseReview(body)).toEqual(cards.map((card) => card.question));
});
