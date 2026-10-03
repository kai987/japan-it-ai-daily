import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { BOT_EMAIL, PUBLISHER_TRAILER, isDailyPublicationPath, verifyPublisherOrigin, publisherRangeFromEvent,
  verifyPublisherRange, verifyPublisherEvent } from '../../scripts/verify-publisher-origin.mjs';

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
  assert.match(workflow, /-f source_commit="\$\(git rev-parse HEAD\)"/);
});

const repository = 'kai987/japan-it-ai-daily';
const sha = (digit) => digit.repeat(40);
const message = `content: publish verified daily\n\n${PUBLISHER_TRAILER}\nPublication-Request: daily-2026-09-25-abcdef12`;
const push = (extra = {}) => ({ eventName: 'push', event: { ref: 'refs/heads/main', before: sha('a'), after: sha('b'),
  repository: { full_name: repository } }, head: sha('b'), ref: 'refs/heads/main', repository, ...extra });
const deployed = (head = sha('a'), extra = {}) => ({ head_sha: head, head_branch: 'main', path: '.github/workflows/deploy.yml',
  status: 'completed', conclusion: 'success', head_repository: { full_name: repository }, ...extra });

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'publisher-origin-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '-b', 'main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.com');
  const commit = (path, value, commitMessage = 'fixture change', email = 'fixture@example.com') => {
    mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value);
    git('add', '--', path);
    execFileSync('git', ['commit', '-q', '-m', commitMessage], { cwd: root, stdio: 'pipe',
      env: { ...process.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: email } });
    return git('rev-parse', 'HEAD');
  };
  return { root, git, commit };
}

test('push range is bound to actual before/after, main ref and repository observations', () => {
  assert.deepEqual(publisherRangeFromEvent(push()), { base: sha('a'), head: sha('b'), source: 'push-before' });
  for (const observation of [push({ event: undefined }), push({ head: sha('c') }), push({ ref: 'refs/heads/draft/daily-2026-09-25' }),
    push({ repository: 'wrong/repository' }), push({ event: { ...push().event, before: undefined } }),
    push({ event: { ...push().event, before: '0'.repeat(40) } }), push({ event: { ...push().event, before: 'HEAD^' } }),
    push({ event: { ...push().event, before: sha('b') } }), push({ event: { ...push().event, forced: true } }),
    push({ event: { ...push().event, deleted: true } }), push({ event: { ...push().event, ref: 'refs/heads/other' } })]) {
    assert.throws(() => publisherRangeFromEvent(observation));
  }
});

test('dispatch uses a successful observed main deployment and rejects a raced publisher SHA', () => {
  const observation = push({ eventName: 'workflow_dispatch', event: { repository: { full_name: repository }, inputs: { source_commit: sha('b') } }, baselineRun: deployed() });
  assert.deepEqual(publisherRangeFromEvent(observation), { base: sha('a'), head: sha('b'), source: 'completed-main-deployment' });
  assert.throws(() => publisherRangeFromEvent({ ...observation, baselineRun: undefined }), /requires/);
  assert.throws(() => publisherRangeFromEvent({ ...observation, baselineRun: deployed(sha('a'), { status: 'in_progress' }) }), /requires/);
  assert.throws(() => publisherRangeFromEvent({ ...observation, baselineRun: deployed(sha('a'), { path: '.github/workflows/sync-r2-audio.yml' }) }), /requires/);
  assert.throws(() => publisherRangeFromEvent({ ...observation, event: { ...observation.event, inputs: { source_commit: sha('c') } } }), /source_commit/);
  assert.throws(() => publisherRangeFromEvent({ ...observation, eventName: 'schedule' }), /Unsupported/);
});

test('a direct daily write followed by a harmless code commit fails across the complete introduced range', (t) => {
  const { root, commit } = fixture(t); const base = commit('README.md', 'base');
  const unauthorized = commit(daily, 'direct write'); const head = commit('src/code.mjs', '// code');
  assert.throws(() => verifyPublisherRange({ base, head, root }), new RegExp(`${unauthorized}: .*only be committed`));
});

test('valid publisher publication followed by code is accepted without scanning lawful older history', (t) => {
  const { root, commit } = fixture(t);
  // Legacy historical reports predate this operational safeguard.
  const base = commit('src/content/daily/2026-08-12.md', 'legacy content');
  const publication = commit(daily, 'verified content', message, BOT_EMAIL); const head = commit('src/code.mjs', '// code');
  const result = verifyPublisherRange({ base, head, root });
  assert.equal(result.commits.length, 2); assert.equal(result.enforced, 1); assert.equal(result.commits[0].commit, publication);
});

test('merged side-branch daily writes cannot hide behind a code-only merge tip', (t) => {
  const { root, git, commit } = fixture(t); const base = commit('README.md', 'base');
  git('checkout', '-q', '-b', 'feature'); const unauthorized = commit(daily, 'direct write');
  git('checkout', '-q', 'main'); commit('src/code.mjs', '// code'); git('merge', '-q', '--no-ff', 'feature', '-m', 'merge feature');
  assert.throws(() => verifyPublisherRange({ base, head: git('rev-parse', 'HEAD'), root }), new RegExp(unauthorized));
});

test('a human merge cannot publish daily paths even when its side commit has publisher trailers', (t) => {
  const { root, git, commit } = fixture(t); const base = commit('README.md', 'base');
  git('checkout', '-q', '-b', 'feature'); commit(daily, 'verified content', message, BOT_EMAIL);
  git('checkout', '-q', 'main'); commit('src/code.mjs', '// code'); git('merge', '-q', '--no-ff', 'feature', '-m', 'merge feature');
  const head = git('rev-parse', 'HEAD');
  assert.throws(() => verifyPublisherRange({ base, head, root }), new RegExp(head));
});

test('old main as second merge parent does not recheck its already published daily history', (t) => {
  const { root, git, commit } = fixture(t); commit('README.md', 'base');
  git('checkout', '-q', '-b', 'feature'); commit('src/code.mjs', '// code');
  git('checkout', '-q', 'main'); const base = commit(daily, 'verified content', message, BOT_EMAIL);
  git('checkout', '-q', 'feature'); git('merge', '-q', '--no-ff', 'main', '-m', 'merge main into feature');
  const result = verifyPublisherRange({ base, head: git('rev-parse', 'HEAD'), root });
  assert.equal(result.commits.length, 2); assert.equal(result.enforced, 0);
});

test('human merge resurrection of legacy content is checked even when old source commits precede the push range', (t) => {
  const { root, git, commit } = fixture(t); commit(daily, 'legacy content');
  git('checkout', '-q', '-b', 'feature'); commit('src/code.mjs', '// code');
  git('checkout', '-q', 'main'); git('rm', '-q', '--', daily); git('commit', '-q', '-m', 'remove legacy file');
  const base = git('rev-parse', 'HEAD');
  git('merge', '--no-ff', '--no-commit', 'feature'); git('checkout', 'feature', '--', daily); git('commit', '-q', '-m', 'restore legacy through merge');
  const head = git('rev-parse', 'HEAD');
  assert.throws(() => verifyPublisherRange({ base, head, root }), new RegExp(head));
});

test('a merge resolution introducing new daily bytes requires publisher ownership', (t) => {
  const { root, git, commit } = fixture(t); const base = commit(daily, 'legacy content\n');
  git('checkout', '-q', '-b', 'feature'); commit(daily, 'feature content\n', message, BOT_EMAIL);
  git('checkout', '-q', 'main'); commit(daily, 'main content\n', message, BOT_EMAIL);
  assert.throws(() => git('merge', '--no-ff', 'feature', '-m', 'merge feature'));
  const head = commit(daily, 'new conflict resolution\n', 'merge resolution');
  assert.throws(() => verifyPublisherRange({ base, head, root }), new RegExp(head));
});

test('missing and divergent range commits fail closed', (t) => {
  const { root, git, commit } = fixture(t); const base = commit('README.md', 'base');
  git('checkout', '-q', '-b', 'other'); const divergent = commit('other.txt', 'other');
  git('checkout', '-q', 'main'); const head = commit('main.txt', 'main');
  assert.throws(() => verifyPublisherRange({ base: sha('f'), head, root }), /ancestor/);
  assert.throws(() => verifyPublisherRange({ base: divergent, head, root }), /ancestor/);
  assert.throws(() => verifyPublisherRange({ base, head: 'HEAD', root }), /ancestor/);
});

test('new root history introduced by a merge is refused', (t) => {
  const { root, git, commit } = fixture(t); const base = commit('README.md', 'base');
  git('checkout', '-q', '--orphan', 'unrelated'); git('rm', '-q', '-rf', '.');
  const unrelated = commit('other.txt', 'other'); git('checkout', '-q', 'main');
  git('merge', '-q', '--no-ff', '--allow-unrelated-histories', 'unrelated', '-m', 'merge unrelated');
  assert.throws(() => verifyPublisherRange({ base, head: git('rev-parse', 'HEAD'), root }), new RegExp(`root commit ${unrelated}`));
});

test('runtime requires real event observations and exact checked out SHA', async (t) => {
  const { root, commit } = fixture(t); const base = commit('README.md', 'base'); const head = commit('code.txt', 'code');
  await assert.rejects(verifyPublisherEvent({}, { root }), /GITHUB_EVENT_PATH/);
  const eventPath = join(root, 'event.json');
  writeFileSync(eventPath, JSON.stringify({ ...push().event, before: base, after: head }));
  const env = { GITHUB_EVENT_PATH: eventPath, GITHUB_EVENT_NAME: 'push', GITHUB_SHA: head, GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: repository };
  assert.equal((await verifyPublisherEvent(env, { root })).commits.length, 1);
  await assert.rejects(verifyPublisherEvent({ ...env, GITHUB_SHA: sha('f') }, { root }), /Workflow SHA/);
});

test('dispatch runtime inspects all commits since the actual successful deployment and fails on unavailable observation', async (t) => {
  const { root, commit } = fixture(t); const base = commit('README.md', 'base'); commit(daily, 'direct write'); const head = commit('code.txt', 'code');
  const eventPath = join(root, 'event.json'); writeFileSync(eventPath, JSON.stringify({ repository: { full_name: repository }, inputs: { source_commit: head } }));
  const env = { GITHUB_EVENT_PATH: eventPath, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_SHA: head, GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: repository, GITHUB_RUN_ID: '99' };
  await assert.rejects(verifyPublisherEvent(env, { root, readRuns: async () => [{ ...deployed(base), id: 1, updated_at: '2026-10-03T06:00:00Z' }] }), /only be committed/);
  await assert.rejects(verifyPublisherEvent(env, { root, readRuns: async () => [] }), /requires/);
  await assert.rejects(verifyPublisherEvent(env, { root, readRuns: async () => { throw new Error('read denied'); } }), /read denied/);
});

test('deploy workflow checks complete history with bounded jobs and does not silently skip main ownership', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(workflow, /fetch-depth: 0/); assert.match(workflow, /timeout-minutes: 20/);
  assert.match(workflow, /Verify main daily publisher ownership\n\s+if: github.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /source_commit:/); assert.match(workflow, /actions: read/);
});
