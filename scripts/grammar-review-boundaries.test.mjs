import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { makeGrammarKey } from './check-grammar-history.mjs';
import { buildStudyArchive, matcherFor } from './learning-review.mjs';
import { reviewAudioCardsForDate } from './learning-audio-plan.mjs';

const rules = JSON.parse(readFileSync(new URL('../docs/grammar-history/identity-rules.json', import.meta.url), 'utf8'));
const key = makeGrammarKey(rules);
const match = pattern => matcherFor({ pattern }, 'grammar', rules, key);
const continuing = match('～限り');

test.each([
  '接続が続いている限り、同じ処理の結果を待ちます。',
  'メモリの課金はリクエストがなくても環境が残っている限り続きます。',
  '契約が有効である限り、利用できます。',
  '通信状態が良い限り、処理を継続します。',
])('retains positive continuing conditions: %s', text => {
  expect(continuing(text)?.form).toBe('限り');
});

test.each([
  '公式資料は仕様の境界確認に限り補足します。',
  '登録した利用者に限り、閲覧できます。',
  '明示的に許可しない限り、変更しません。',
  'わたしが調べた限りでは、再現しませんでした。',
  'ただしファイルが作れても、別の値で正しく描けるとは限りません。',
  '必ずしも同じ結果になるとは限りませんでした。',
  '対象を一部に限ります。',
  '例外は一つに限りません。',
  '限りない改善を目指します。',
  '限りなく近い値です。',
])('does not count a different grammar function as a continuing condition: %s', text => {
  expect(continuing(text)).toBeNull();
});

test('other registered families retain their own evidence', () => {
  expect(match('～に限って')('公式資料は仕様の境界確認に限り補足します。')?.form).toBe('に限り');
  expect(match('～ない限り')('明示的に許可しない限り、変更しません。')?.form).toBe('ない限り');
  expect(match('～とは限らない')('別の値で正しく描けるとは限りません。')?.form).toBe('とは限りません');
});

test('a rejected occurrence does not hide later valid evidence in the same chunk', () => {
  expect(continuing('利用者に限り公開します。契約が有効である限り閲覧できます。')?.excerpt)
    .toContain('有効である限り');
  expect(continuing('成功するとは限りません。接続が続いている限り待ちます。')?.form).toBe('限り');
});

test('the complete bilingual archive and N1 snapshot source no longer select the false October31 review', () => {
  const archive = buildStudyArchive();
  for (const locale of ['zh', 'ja']) {
    const day = archive.lessons['2026-10-31'][locale];
    expect(day.reviewGrammar.some(card => card.identity === '限り')).toBe(false);
    expect(day.reviewGrammar.find(card => card.identity === 'に従って')?.reviewEvidence.form).toBe('に従い');
    const introduction = archive.lessons['2026-10-20'][locale].grammar.find(card => card.identity === '限り');
    expect(introduction.exampleJa).toBe('接続が続いている限り、同じ処理の結果を待ちます。');
    expect(introduction.reportFrequency.appearedDates).not.toContain('2026-10-31');
  }
});

test('affected dates reuse the recordings of their actual selected review cards', () => {
  const archive = buildStudyArchive();
  for (const date of ['2026-10-23', '2026-10-24', '2026-10-27', '2026-10-29', '2026-10-30', '2026-10-31']) {
    const manifest = JSON.parse(readFileSync(`public/audio/japanese/${date}/manifest.json`, 'utf8'));
    const reviews = manifest.grammar.filter(card => card.studyKind === 'review');
    expect(reviews.map(card => card.identity)).toEqual(reviewAudioCardsForDate(process.cwd(), date, archive).grammar.map(card => card.identity));
    for (const card of reviews) {
      const source = JSON.parse(readFileSync(`public/audio/japanese/${card.audioDate}/manifest.json`, 'utf8'));
      const recording = source.grammar.find(item => item.studyKind !== 'review' && item.example === card.example);
      expect(recording?.exampleJa).toBe(card.exampleJa);
      expect(recording?.exampleSha256).toBe(card.exampleSha256);
    }
  }
});
