import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POLICY, validDate, tokyoClock, dueDates, requiredFiles, requiredSidecars, initialCheckpoint,
  claimLease, renewLease, assertLease, classifyFailure, releaseVerified, planPublication } from '../../scripts/daily-publication.mjs';
const sha = 'a'.repeat(40), date = '2026-09-22', now = '2026-09-22T15:31:00+09:00';
const inventory = { complete: true, sourceCommit: sha, files: [] };
const full = { ...inventory, files: [...requiredFiles(date), ...requiredSidecars(date)] };
const run = { id: 123, branch: 'main', path: POLICY.workflowPath, headSha: sha, status: 'completed', conclusion: 'failure' };
const observed = extra => ({ now, inventory, ...extra });
const verified = { ...run, conclusion: 'success', build: 'success', deploy: 'success', publicationVerification: 'success',
  snapshotSourceCommit: sha, snapshotDates: [date], grammarLessonDates: [date] };
test('JST date is independent of UTC date', () => assert.equal(tokyoClock('2026-09-21T18:31:00Z').date, date));
test('daily starts at 10; recovery waits until 11', () => {
  assert.deepEqual(dueDates('2026-09-22T10:59:00+09:00'), []);
  assert.deepEqual(dueDates('2026-09-22T10:00:00+09:00', { recovery: false }), [date]);
  assert.deepEqual(dueDates('2026-09-22T11:00:00+09:00'), [date]);
});
test('invalid dates and unzoned timestamps fail closed', () => {
  assert.throws(() => validDate('2026-02-30'));
  assert.throws(() => tokyoClock('2026-09-22T10:00:00'));
});
test('four absent files start generation, not deploy retry', () => assert.equal(planPublication(observed()).action, 'register_and_generate'));
test('partial content is resumed', () => assert.equal(planPublication(observed({ inventory: { ...inventory, files: requiredFiles(date).slice(0, 1) } })).reason, 'partial_content'));
test('a checkpoint survives a killed generator', () => {
  const checkpoint = { ...initialCheckpoint(date, sha, now), stage: 'sources_verified' };
  const plan = planPublication(observed({ checkpoints: { [date]: checkpoint } }));
  assert.equal(plan.action, 'resume_generation'); assert.equal(plan.resumeFrom, 'sources_verified');
});
test('oldest date is recovered across midnight, even with no checkpoint', () => {
  const plan = planPublication(observed({ now: '2026-09-24T11:00:00+09:00' }));
  assert.equal(plan.targetDate, date); assert.equal(plan.pendingDates.length, 3);
});
test('API failure and truncated inventory never mean no content', () => {
  assert.equal(planPublication(observed({ inventory: { ...inventory, complete: false } })).action, 'inspect');
  assert.equal(planPublication(observed({ inventory: { ...inventory, sourceCommit: '' } })).action, 'inspect');
});
test('live lease prevents another writer', () => {
  const lease = claimLease(null, { owner: 'daily', token: 'fence-1', targetDate: date, now });
  assert.equal(planPublication(observed({ lease })).action, 'wait');
  assert.throws(() => claimLease(lease, { owner: 'recovery', token: 'fence-2', targetDate: date, now }));
});
test('expired leases can be taken over but stale workers cannot renew', () => {
  const lease = claimLease(null, { owner: 'daily', token: 'one', targetDate: date, now });
  const later = '2026-09-22T16:17:00+09:00';
  const second = claimLease(lease, { owner: 'recovery', token: 'two', targetDate: date, now: later });
  assert.throws(() => assertLease(second, 'one', date, later));
  assert.throws(() => renewLease(lease, 'one', later));
  assert.equal(renewLease(second, 'two', later).token, 'two');
});
test('active unique publisher blocks a second author even after the author lease is released', () => {
  const publisherRun = {
    id: 456,
    branch: POLICY.requestBranch,
    path: POLICY.publisherWorkflowPath,
    status: 'in_progress',
  };
  const plan = planPublication(observed({ publisherRun }));
  assert.equal(plan.action, 'wait');
  assert.equal(plan.reason, 'publisher_in_progress');
  assert.equal(plan.runId, publisherRun.id);
});
test('active Pages run is not cancelled or duplicated', () => assert.equal(planPublication(observed({ latestRun: { ...run, status: 'in_progress' } })).reason, 'main_pages_run_in_progress'));
test('required evidence and structured interviews are not forgotten', () => assert.equal(planPublication(observed({ inventory: { ...inventory, files: requiredFiles(date) } })).reason, 'missing_evidence_or_interviews'));
test('no rerun without the exact failed run logs', () => {
  assert.equal(planPublication(observed({ inventory: full, latestRun: run })).action, 'read_failed_logs');
  assert.equal(planPublication(observed({ inventory: full, latestRun: run, failure: { logsRead: true, runId: 99, headSha: sha } })).action, 'read_failed_logs');
});
test('transient errors retry but assertion/schema errors need repair', () => {
  const base = { inventory: full, latestRun: run, failure: { logsRead: true, runId: run.id, headSha: sha, log: 'HTTP 503', attempts: 0 } };
  assert.equal(planPublication(observed(base)).action, 'retry_failed_jobs');
  assert.equal(planPublication(observed({ ...base, failure: { ...base.failure, log: 'AssertionError: timeout', attempts: 0 } })).action, 'minimal_fix_then_validate');
  assert.equal(planPublication(observed({ ...base, failure: { ...base.failure, attempts: 3 } })).action, 'defer_retry');
});
test('unknown timeouts do not imply a transient root cause', () => assert.equal(classifyFailure({ log: 'Task timed out' }), 'unknown'));
test('authorization and SHA conflict are not blind retries', () => {
  assert.equal(classifyFailure({ statusCode: 403 }), 'permission');
  assert.equal(classifyFailure({ statusCode: 409 }), 'conflict');
});
test('success requires target date, same SHA, build, deploy, and verified snapshot', () => {
  assert.equal(releaseVerified(verified, sha, date), true);
  for (const patch of [{ deploy: 'skipped' }, { publicationVerification: 'failure' }, { branch: 'draft/daily-2026-09-22' },
    { path: '.github/workflows/sync-r2-audio.yml' }, { snapshotSourceCommit: 'b'.repeat(40) }, { snapshotDates: [] }, { grammarLessonDates: [] }]) {
    assert.equal(releaseVerified({ ...verified, ...patch }, sha, date), false);
  }
});
test('yesterday success cannot hide missing today', () => assert.equal(planPublication(observed({ release: { ...verified, snapshotDates: ['2026-09-21'] } })).action, 'register_and_generate'));
test('workflow success without verified snapshot is not publication success', () => assert.equal(planPublication(observed({ inventory: full, latestRun: { ...run, conclusion: 'success' } })).action, 'verify_publication'));
test('already verified date is idempotent', () => assert.equal(planPublication(observed({ inventory: full, release: verified, latestRun: { ...run, conclusion: 'success' } })).action, 'idle'));
test('new main commit invalidates stale success', () => assert.notEqual(planPublication(observed({ inventory: { ...full, sourceCommit: 'b'.repeat(40) }, release: verified })).action, 'idle'));
test('checkpoint locks original target date and news window', () => {
  const state = initialCheckpoint(date, sha, now);
  assert.equal(state.sourceWindow.from, '2026-09-21T10:00:00+09:00');
  assert.equal(state.sourceWindow.to, '2026-09-22T10:00:00+09:00');
  assert.equal(state.targetDate, date); assert.equal(state.stage, 'registered');
});
