import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildStudyArchive, matcherFor } from '../../scripts/learning-review.mjs';
import { makeGrammarKey } from '../../scripts/check-grammar-history.mjs';
const rules = JSON.parse(readFileSync(new URL('../../docs/grammar-history/identity-rules.json', import.meta.url), 'utf8'));
const key = makeGrammarKey(rules);
const match = pattern => matcherFor({ pattern }, 'grammar', rules, key);

test('dictionary 上で does not borrow spatial or past-tense evidence', () => {
  const check = match('～する上で');
  for (const text of ['エディター上で操作を試す。', '従業員300人以上で複数製品を使う。', '確認した上で実行する。', '机のうえで作業する。']) assert.equal(check(text), null, text);
  for (const text of ['本番利用する上で認可が重要です。', 'コードを書く上でテストを重視する。', '設計を考えるうえで要件を確認する。']) assert.ok(check(text), text);
  assert.ok(match('～した上で')('確認した上で実行する。'));
  const later = check('エディター上で確認する。本番利用する上で認可が必要です。');
  assert.equal(later.form, 'する上で');
});

test('additive に加え skips the lexical verb and finds a later true conjunction', () => {
  const check = match('～に加えて');
  assert.equal(check('作業成功率を評価に加えると判断しやすくなります。'), null);
  for (const text of ['時間に加え、見落としも測定する。', '対談に加えて導入事例も紹介する。']) assert.ok(check(text), text);
  const later = check('成功率を評価に加えると役立つ。時間に加え、見落としも測定する。');
  assert.equal(later.form, 'に加え');
});

test('means expression does not borrow a completed test-passing action', () => {
  const check = match('～を通じて');
  assert.equal(check('接続テストを通しただけで保守対応を終えたとはいえません。'), null);
  assert.ok(check('対話を通した理解を深めます。'));
  assert.ok(check('利用者との対話を通じて要件を確認します。'));
});

test('September 26 shared history rejects false evidence while preserving source counts and mirrors', () => {
  const archive = buildStudyArchive();
  const day = archive.lessons['2026-09-26'];
  assert.equal(day.zh.vocabulary.length, 15);
  assert.equal(day.zh.grammar.length, 2);
  assert.equal(day.zh.reviewVocabulary.length, 5);
  assert.equal(day.zh.reviewGrammar.some(c => c.identity === '上で'), false);
  assert.equal(day.zh.reviewGrammar.some(c => c.identity === 'を通じて'), false);
  const additive = day.zh.reviewGrammar.find(c => c.identity === 'に加えて');
  assert.ok(additive);
  assert.equal(additive.reviewEvidence.form, 'に加え');
  assert.ok(additive.reviewEvidence.excerpt.includes('初動までの時間に加え、'));
  assert.equal(additive.reviewEvidence.excerpt.includes('評価に加えると'), false);
  for (const card of day.zh.reviewGrammar) {
    assert.ok(card.firstIntroducedDate < day.date);
    assert.ok(card.reviewEvidence.excerpt.includes(card.reviewEvidence.form));
    assert.equal(card.reportFrequency.totalDays, archive.totalDays);
  }
  assert.deepEqual(day.zh.reviewGrammar.map(c => [c.identity, c.reviewEvidence]), day.ja.reviewGrammar.map(c => [c.identity, c.reviewEvidence]));
  assert.ok(day.zh.studyGrammarCount >= 5 && day.zh.studyGrammarCount <= 8);
});
