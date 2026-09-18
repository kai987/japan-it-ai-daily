import { expect, test } from 'vitest';
import { analyzeR2Orphans, parseRemoteObjects } from './audit-r2-audio-orphans.mjs';

test('classifies only legacy review recordings as safe auto-prune candidates', () => {
  const local = [
    'japanese/2026-08-12/vocab-01.mp3',
    'japanese/2026-08-12/example-01.mp3',
    'japanese/2026-08-12/manifest.json',
  ];
  const remote = [
    { key: 'japanese/2026-08-12/vocab-01.mp3', size: 10 },
    { key: 'japanese/2026-08-12/example-01.mp3', size: 20 },
    { key: 'japanese/2026-08-12/manifest.json', size: 30 },
    { key: 'japanese/2026-08-12/review-vocab-01.mp3', size: 40 },
    { key: 'japanese/2026-08-12/review-example-01.mp3', size: 50 },
    { key: 'japanese/2026-08-12/review-grammar-example-01.mp3', size: 60 },
    { key: 'japanese/2026-08-12/obsolete.mp3', size: 70 },
    { key: 'other-prefix/keep-me.bin', size: 80 },
  ];

  const result = analyzeR2Orphans(local, remote);
  expect(result.safeLegacy.map((item) => item.key)).toEqual([
    'japanese/2026-08-12/review-example-01.mp3',
    'japanese/2026-08-12/review-grammar-example-01.mp3',
    'japanese/2026-08-12/review-vocab-01.mp3',
  ]);
  expect(result.otherOrphans.map((item) => item.key)).toEqual([
    'japanese/2026-08-12/obsolete.mp3',
  ]);
  expect(result.safeLegacyBytes).toBe(150);
  expect(result.orphanedBytes).toBe(220);
  expect(result.missingRemote).toEqual([]);
});

test('treats the audited 2026-08-29 answer-06 orphan as an explicit safe prune', () => {
  const result = analyzeR2Orphans(
    ['japanese/2026-08-29/interview-answer-05.mp3'],
    [
      { key: 'japanese/2026-08-29/interview-answer-05.mp3', size: 10 },
      { key: 'japanese/2026-08-29/interview-answer-06.mp3', size: 298414 },
    ],
  );
  expect(result.safeLegacy.map((item) => item.key)).toEqual([
    'japanese/2026-08-29/interview-answer-06.mp3',
  ]);
  expect(result.otherOrphans).toEqual([]);
});

test('reports local managed files missing from R2 and ignores unrelated prefixes', () => {
  const result = analyzeR2Orphans(
    ['japanese/2026-09-18/vocab-01.mp3', 'japanese/2026-09-18/manifest.json'],
    [{ key: 'other-prefix/unrelated.mp3', size: 1 }],
  );
  expect(result.remoteManagedCount).toBe(0);
  expect(result.orphaned).toEqual([]);
  expect(result.missingRemote.map((item) => item.key)).toEqual([
    'japanese/2026-09-18/manifest.json',
    'japanese/2026-09-18/vocab-01.mp3',
  ]);
});

test('parses AWS-style object JSON or bare key arrays', () => {
  expect(parseRemoteObjects('[{"Key":"japanese/a.mp3","Size":123}]')).toEqual([
    { key: 'japanese/a.mp3', size: 123 },
  ]);
  expect(parseRemoteObjects('["japanese/b.mp3"]')).toEqual([
    { key: 'japanese/b.mp3', size: null },
  ]);
});
