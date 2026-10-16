import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { R2_WORKFLOW_PATH, observeR2SyncBaseline, selectR2SyncBaseline } from '../../scripts/r2-sync-baseline.mjs';
import { readSuccessfulWorkflowRuns, latestSuccessfulWorkflowRun, gitBaselineIsAncestor } from '../../scripts/workflow-success-baseline.mjs';

const repository = 'kai987/japan-it-ai-daily';
const sha = (digit) => digit.repeat(40);
const run = (id, head = sha('a'), extra = {}) => ({ id, head_sha: head, head_branch: 'main', head_repository: { full_name: repository },
  path: R2_WORKFLOW_PATH, status: 'completed', conclusion: 'success', updated_at: `2026-10-03T06:${String(id).padStart(2, '0')}:00Z`, ...extra });
const observation = (runs, extra = {}) => ({ eventName: 'push', head: sha('f'), runs, repository, currentRunId: 99,
  isAncestor: () => true, ...extra });

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'r2-baseline-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.com');
  const commit = (path, value) => {
    mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value);
    git('add', '--', path); git('commit', '-q', '-m', 'fixture change'); return git('rev-parse', 'HEAD');
  };
  return { root, git, commit };
}

test('baseline is the latest completed whole-workflow success, including a later retry of an older push', () => {
  const olderPushRetry = run(1, sha('a'), { created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-03T07:00:00Z' });
  assert.equal(selectR2SyncBaseline(observation([run(2, sha('b')), olderPushRetry])).base, sha('a'));
});

test('failed, cancelled, skipped, running, foreign and current workflow observations never advance the baseline', () => {
  const invalid = [run(2, sha('b'), { conclusion: 'failure' }), run(3, sha('c'), { conclusion: 'cancelled' }),
    run(4, sha('d'), { conclusion: 'skipped' }), run(5, sha('e'), { status: 'in_progress' }),
    run(6, sha('b'), { head_branch: 'draft/daily-2026-10-03' }), run(7, sha('c'), { path: '.github/workflows/deploy.yml' }),
    run(8, sha('d'), { head_repository: { full_name: 'elsewhere/other' } }), run(9, sha('e'), { head_sha: 'abc' }),
    run(99, sha('f'), { updated_at: '2026-10-03T08:00:00Z' })];
  assert.equal(selectR2SyncBaseline(observation([...invalid, run(1)])).base, sha('a'));
});

test('missing, shallow and nonancestor baselines widen to full audit instead of event.before or an older success', () => {
  assert.equal(selectR2SyncBaseline(observation([])).reason, 'no-completed-success-full-audit');
  const result = selectR2SyncBaseline(observation([run(1), run(2, sha('b'))], { isAncestor: (base) => base === sha('a') }));
  assert.equal(result.base, ''); assert.equal(result.reason, 'unavailable-or-nonancestor-full-audit');
});

test('manual and weekly runs always audit the full inventory', () => {
  for (const eventName of ['workflow_dispatch', 'schedule']) {
    assert.equal(selectR2SyncBaseline(observation([run(1)], { eventName })).base, '');
  }
  assert.throws(() => selectR2SyncBaseline(observation([], { eventName: 'pull_request' })), /Unsupported/);
});

test('success selector requires exact successful main workflow and repository metadata', () => {
  const options = { repository, workflowPath: R2_WORKFLOW_PATH };
  assert.equal(latestSuccessfulWorkflowRun([run(1, sha('a'), { status: 'queued' })], options), null);
  assert.equal(latestSuccessfulWorkflowRun([run(1, sha('a'), { head_repository: undefined })], options), null);
  assert.throws(() => latestSuccessfulWorkflowRun(undefined, options), /observations/);
});

test('cumulative Git diff retains audio and verifier changes from canceled or skipped intermediate batches', (t) => {
  const { root, git, commit } = fixture(t);
  const base = commit('README.md', 'base');
  const first = commit('public/audio/japanese/2026-10-01/words.json', '{}');
  commit('scripts/verify-audio-integrity.mjs', '// updated verifier');
  const head = commit('public/audio/japanese/2026-10-02/word-01.mp3', 'fixture bytes');
  const result = selectR2SyncBaseline(observation([run(1, base), run(2, first, { conclusion: 'cancelled' })], {
    head, isAncestor: (before, after) => gitBaselineIsAncestor(before, after, root),
  }));
  assert.equal(result.base, base);
  assert.deepEqual(git('diff', '--name-only', result.base, head).split('\n'), [
    'public/audio/japanese/2026-10-01/words.json', 'public/audio/japanese/2026-10-02/word-01.mp3', 'scripts/verify-audio-integrity.mjs',
  ]);
});

test('Git ancestor check rejects missing commits and divergent history', (t) => {
  const { root, git, commit } = fixture(t);
  const base = commit('README.md', 'base');
  git('checkout', '-q', '-b', 'other'); const divergent = commit('other.txt', 'other');
  git('checkout', '-q', 'main'); const head = commit('main.txt', 'main');
  assert.equal(gitBaselineIsAncestor(base, head, root), true);
  assert.equal(gitBaselineIsAncestor(divergent, head, root), false);
  assert.equal(gitBaselineIsAncestor(sha('f'), head, root), false);
});

test('all workflow result pages are observed before choosing the most recently completed success', async () => {
  const calls = [];
  const result = await readSuccessfulWorkflowRuns({ repository, workflowPath: R2_WORKFLOW_PATH, token: 'fixture-token',
    fetchImpl: async (url) => {
      calls.push(url);
      return { ok: true, json: async () => ({ total_count: 2, workflow_runs: calls.length === 1 ? [run(1)] : [run(2)] }) };
    } });
  assert.equal(calls.length, 2); assert.match(calls[1], /page=2$/); assert.equal(result.length, 2);
  assert.equal(latestSuccessfulWorkflowRun(result, { repository, workflowPath: R2_WORKFLOW_PATH }).id, 2);
});

test('API denial, truncation and incomplete pagination cannot become a trusted baseline', async () => {
  const options = { repository, workflowPath: R2_WORKFLOW_PATH, token: 'fixture-token' };
  await assert.rejects(readSuccessfulWorkflowRuns({ ...options, fetchImpl: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
  await assert.rejects(readSuccessfulWorkflowRuns({ ...options, fetchImpl: async () => ({ ok: true, json: async () => ({ total_count: 1001, workflow_runs: [run(1)] }) }) }), /search cap/);
  await assert.rejects(readSuccessfulWorkflowRuns({ ...options, fetchImpl: async () => ({ ok: true, json: async () => ({ total_count: 1, workflow_runs: [] }) }) }), /incomplete/);
  await assert.rejects(readSuccessfulWorkflowRuns({ ...options, fetchImpl: async () => ({ ok: true, json: async () => ({ workflow_runs: [] }) }) }), /Incomplete/);
});

test('read failures fall back to full audit, and manual runs do not require an API baseline', async (t) => {
  const { root, commit } = fixture(t); const head = commit('README.md', 'base');
  const env = { GITHUB_EVENT_NAME: 'push', GITHUB_SHA: head, GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: repository };
  const result = await observeR2SyncBaseline(env, { root, readRuns: async () => { throw new Error('read denied'); } });
  assert.equal(result.reason, 'baseline-read-failed-full-audit');
  const manual = await observeR2SyncBaseline({ ...env, GITHUB_EVENT_NAME: 'workflow_dispatch' }, { root, readRuns: async () => { throw new Error('must not query'); } });
  assert.equal(manual.reason, 'manual-or-weekly-full-audit');
  await assert.rejects(observeR2SyncBaseline({ ...env, GITHUB_SHA: sha('f') }, { root }), /ref\/SHA/);
});

test('R2 workflow preserves serialized cumulative recovery and full manual audits', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/sync-r2-audio.yml', import.meta.url), 'utf8');
  assert.match(workflow, /cancel-in-progress: false/); assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /actions: read/); assert.match(workflow, /timeout-minutes: 25/);
  assert.match(workflow, /node scripts\/r2-sync-baseline\.mjs/); assert.doesNotMatch(workflow, /SYNC_BEFORE|github\.event\.before/);
  assert.match(workflow, /git diff --name-only -z "\$\{R2_SYNC_BASE\}" HEAD/);
  assert.match(workflow, /verify_args=\(--remote --repair\)/);
  assert.match(workflow, /cron: '43 2 \* \* 1'/);
  assert.match(workflow, /japanese\/2026-08-29\/interview-answer-06\.mp3/);
});
