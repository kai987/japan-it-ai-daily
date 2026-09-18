import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateStructuredInterview, structuredAudioItems, structuredAnswers, structuredReviewCards } from './structuredInterview.mjs';
import { readStructuredInterview } from '../../scripts/structured-interview.mjs';
import { parseInterview, parseReview } from '../../scripts/interview-audio-content.mjs';
import { assertInterviewMirror, validateStructuredInterviews } from '../../scripts/validate-structured-interviews.mjs';
import { readContent } from '../../scripts/content-files.mjs';

const root = process.cwd(), date = '2026-09-18';
const pilot = JSON.parse(readFileSync(join(root, 'src/data/interviews', `${date}.json`), 'utf8'));
const clone = () => structuredClone(pilot);

test('the real pilot validates both report mirrors and article references', () => {
  assert.ok(validateStructuredInterviews(root).dates >= 1);
  assert.equal(structuredAnswers(pilot).length, 5);
  assert.equal(structuredReviewCards(pilot, 'ja').length, 3);
});

for (const [name, mutate, expected] of [
  ['unknown version', record => { record.schemaVersion = 2; }, /schema/],
  ['date mismatch', record => { record.date = '2026-09-17'; }, /date/],
  ['empty answer', record => { record.interview[0].answer = ''; }, /answer/],
  ['duplicate id', record => { record.interview[1].id = record.interview[0].id; }, /duplicate/],
  ['duplicate references', record => { record.interview[0].articleIds.push(record.interview[0].articleIds[0]); }, /articleIds/],
  ['missing Japanese points', record => { delete record.review[0].points.ja; }, /locales/],
  ['misspelled field', record => { record.interview[0].answr = 'typo'; }, /unknown field/],
]) test(`rejects ${name} instead of accepting corrupt structured data`, () => {
  const record = clone(); mutate(record);
  assert.throws(() => validateStructuredInterview(record, date), expected);
});

for (const [locale, dir] of [['zh', 'daily'], ['ja', 'daily-ja']]) {
  test(`${locale}: audio strings/order remain identical to the legacy source`, () => {
    const source = readFileSync(join(root, 'src/content', dir, `${date}.md`), 'utf8');
    assert.deepEqual(structuredAudioItems(pilot), parseInterview(source, { legacyOnly: true }));
    assert.deepEqual(parseInterview(source), parseInterview(source, { legacyOnly: true }));
    assert.deepEqual(parseReview(source), parseReview(source, { legacyOnly: true }));
  });
  test(`${locale}: changing heading formats does not affect the structured path or mirror check`, () => {
    const { body } = readContent(root, dir, date);
    const reformatted = body.replace(/^#{1,6} .+$/gm, '### Renamed presentation heading');
    assertInterviewMirror(pilot, reformatted, locale);
    const source = `---\ndate: '${date}'\n---\n${reformatted}`;
    assert.deepEqual(parseInterview(source), structuredAudioItems(pilot));
  });
}

test('a changed or reordered mirror is rejected', () => {
  const { body } = readContent(root, 'daily', date);
  assert.throws(() => assertInterviewMirror(pilot, body.replace(pilot.interview[0].answer, 'changed answer'), 'zh'), /mirror/);
  const record = clone(); [record.interview[0], record.interview[1]] = [record.interview[1], record.interview[0]];
  assert.throws(() => assertInterviewMirror(record, body, 'zh'), /mirror/);
});

test('legacy dates keep their parsers unchanged', () => {
  const source = readFileSync(join(root, 'src/content/daily/2026-09-17.md'), 'utf8');
  assert.equal(readStructuredInterview('2026-09-17'), null);
  assert.deepEqual(parseInterview(source), parseInterview(source, { legacyOnly: true }));
  assert.deepEqual(parseReview(source), parseReview(source, { legacyOnly: true }));
});

test('missing required or corrupt records cannot silently fall back', () => {
  const dir = mkdtempSync(join(tmpdir(), 'structured-interview-'));
  try {
    mkdirSync(join(dir, 'docs'), { recursive: true });
    mkdirSync(join(dir, 'src/data/interviews'), { recursive: true });
    writeFileSync(join(dir, 'docs/structured-interview-policy.json'), JSON.stringify({ schemaVersion: 1, requiredDates: [date] }));
    assert.throws(() => readStructuredInterview(date, dir), /unavailable/);
    assert.equal(readStructuredInterview('2026-09-17', dir), null);
    writeFileSync(join(dir, 'src/data/interviews', `${date}.json`), '{bad');
    assert.throws(() => readStructuredInterview(date, dir));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
