import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOT_EMAIL, PUBLISHER_TRAILER, isDailyPublicationPath, verifyPublisherOrigin } from '../../scripts/verify-publisher-origin.mjs';

const daily = 'src/content/daily/2026-09-25.md';
const evidence = 'src/content/evidence/2026-09-25.json';

test('daily publication path matcher is exact', () => {
  assert.equal(isDailyPublicationPath(daily), true);
  assert.equal(isDailyPublicationPath(evidence), true);
  assert.equal(isDailyPublicationPath('src/content/daily/not-a-date.md'), false);
  assert.equal(isDailyPublicationPath('src/content/daily/2026-09-25.md.bak'), false);
  assert.equal(isDailyPublicationPath('docs/daily/2026-09-25.md'), false);
});

test('ordinary code-only commits are not blocked', () => {
  assert.deepEqual(
    verifyPublisherOrigin({ changedPaths: ['src/components/ReportSpeechEnhancer.astro'], message: 'fix: speech', authorEmail: 'dev@example.com' }),
    { publicationPaths: [], enforced: false },
  );
});

test('human or unmarked daily publication commits fail closed', () => {
  assert.throws(() => verifyPublisherOrigin({ changedPaths: [daily], message: 'content: direct write', authorEmail: 'dev@example.com' }));
  assert.throws(() => verifyPublisherOrigin({ changedPaths: [daily], message: 'content: bot write', authorEmail: BOT_EMAIL }));
});

test('publisher bot commit requires exact publisher and request trailers', () => {
  const message = `content: publish verified daily\n\n${PUBLISHER_TRAILER}\nPublication-Request: daily-2026-09-25-abcdef12`;
  const result = verifyPublisherOrigin({ changedPaths: [daily, evidence], message, authorEmail: BOT_EMAIL });
  assert.equal(result.enforced, true);
  assert.deepEqual(result.publicationPaths, [daily, evidence]);
  assert.throws(() => verifyPublisherOrigin({
    changedPaths: [daily],
    message: `content: publish\n\n${PUBLISHER_TRAILER}\nPublication-Request: x`,
    authorEmail: BOT_EMAIL,
  }));
});


test('publisher explicitly dispatches Pages after its GITHUB_TOKEN main push', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/publish-daily.yml', import.meta.url), 'utf8');
  assert.match(workflow, /actions:\s*write/);
  assert.match(workflow, /gh workflow run deploy\.yml --repo "\$GITHUB_REPOSITORY" --ref main/);
});
