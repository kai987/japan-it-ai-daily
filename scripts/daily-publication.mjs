import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Read-only planner. Observations must come from complete, authenticated reads.
// This module never generates news, weakens a content gate, or writes Git refs.
export const POLICY = Object.freeze({
  recoveryFrom: '2026-09-22', timeZone: 'Asia/Tokyo',
  dueHour: 10, recoveryGraceMinutes: 60, leaseMinutes: 45,
  progressBranch: 'automation/daily-progress',
  workflowPath: '.github/workflows/deploy.yml', maxTransientAttempts: 3,
});
const ACTIVE = new Set(['queued', 'pending', 'requested', 'waiting', 'in_progress']);
const SHA = /^[a-f0-9]{40}$/;
function instant(value) {
  if (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value)) throw new Error('Timezone-qualified timestamp required');
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('Invalid timestamp');
  return time;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid targetDate');
  const d = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(d.valueOf()) || d.toISOString().slice(0, 10) !== value) throw new Error('Invalid targetDate');
  return value;
}
const addDay = (date, amount) => new Date(Date.parse(`${validDate(date)}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);
export function tokyoClock(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: POLICY.timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(instant(now))).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
export function dueDates(now, { from = POLICY.recoveryFrom, recovery = true } = {}) {
  validDate(from);
  const clock = tokyoClock(now);
  const cutoff = POLICY.dueHour * 60 + (recovery ? POLICY.recoveryGraceMinutes : 0);
  const last = clock.minutes >= cutoff ? clock.date : addDay(clock.date, -1);
  const dates = [];
  for (let date = from; date <= last; date = addDay(date, 1)) {
    if (dates.length >= 3660) throw new Error('Unexpectedly large recovery range; inspect policy');
    dates.push(date);
  }
  return dates;
}
export function requiredFiles(date) {
  validDate(date);
  return ['daily', 'japanese', 'daily-ja', 'japanese-ja'].map(dir => `src/content/${dir}/${date}.md`);
}
export function requiredSidecars(date) {
  validDate(date);
  return [`src/content/evidence/${date}.json`, `src/data/interviews/${date}.json`];
}
export function initialCheckpoint(date, sourceCommit, now) {
  validDate(date); instant(now);
  if (!SHA.test(sourceCommit)) throw new Error('Real sourceCommit required');
  return {
    schemaVersion: 1, targetDate: date, stage: 'registered', sourceCommit,
    sourceWindow: { from: `${addDay(date, -1)}T10:00:00+09:00`, to: `${date}T10:00:00+09:00` },
    createdAt: now, updatedAt: now, completedArtifacts: [], lastError: null,
  };
}
export function leaseActive(lease, now) {
  if (lease == null) return false;
  if (!lease.owner || !lease.token || !lease.targetDate) throw new Error('Malformed lease');
  validDate(lease.targetDate);
  return instant(lease.expiresAt) > instant(now);
}
export function claimLease(lease, { owner, token, targetDate, now }) {
  if (!owner || !token) throw new Error('Owner and unique fencing token required');
  validDate(targetDate); instant(now);
  if (leaseActive(lease, now)) throw new Error('Another live publisher owns the lease');
  return { owner, token, targetDate, acquiredAt: now, updatedAt: now,
    expiresAt: new Date(instant(now) + POLICY.leaseMinutes * 60000).toISOString() };
}
export function assertLease(lease, token, targetDate, now) {
  if (!leaseActive(lease, now) || lease.token !== token || lease.targetDate !== targetDate) throw new Error('Lost or expired publication lease; do not write');
}
export function renewLease(lease, token, now) {
  assertLease(lease, token, lease?.targetDate, now);
  return { ...lease, updatedAt: now, expiresAt: new Date(instant(now) + POLICY.leaseMinutes * 60000).toISOString() };
}
// Only classify the failed step's real logs, not unrelated warnings in a full run.
export function classifyFailure({ statusCode, log = '' } = {}) {
  if (statusCode === 401 || statusCode === 403) return 'permission';
  if (statusCode === 409 || statusCode === 422) return 'conflict';
  if (/AssertionError|SyntaxError|TypeError|schema[^\n]*(?:invalid|fail|error)|duplicate identity|content integrity[^\n]*error|CSP[^\n]*(?:reject|fail)|(?:quality|bilingual|jlpt|grammar|study)[^\n]*(?:failed|FAIL)/i.test(log)) return 'deterministic';
  if (statusCode === 429 || (statusCode >= 500 && statusCode <= 599)) return 'transient';
  if (/ECONNRESET|ETIMEDOUT|EAI_AGAIN|HTTP (?:502|503|504)|runner[^\n]*(?:lost communication|disconnected)|temporarily unavailable/i.test(log)) return 'transient';
  return 'unknown';
}
export function releaseVerified(release, sourceCommit, targetDate) {
  return Boolean(release && SHA.test(sourceCommit) && release.headSha === sourceCommit &&
    release.branch === 'main' && release.path === POLICY.workflowPath &&
    release.status === 'completed' && release.conclusion === 'success' &&
    release.build === 'success' && release.deploy === 'success' &&
    release.publicationVerification === 'success' &&
    release.snapshotSourceCommit === release.headSha &&
    Array.isArray(release.snapshotDates) && release.snapshotDates.includes(targetDate) &&
    Array.isArray(release.grammarLessonDates) && release.grammarLessonDates.includes(targetDate));
}
export function planPublication(observation) {
  const { now, inventory, checkpoints = {}, lease, release, latestRun, failure } = observation;
  instant(now);
  // A failed/truncated API read is not evidence that the file does not exist.
  if (!inventory?.complete || !SHA.test(inventory.sourceCommit || '') || !Array.isArray(inventory.files)) {
    return { action: 'inspect', reason: 'complete_main_inventory_required' };
  }
  const files = new Set(inventory.files);
  const dates = dueDates(now, { from: observation.from || POLICY.recoveryFrom, recovery: observation.mode !== 'daily' });
  // Preserve explicitly checkpointed backlog as well as dates without a checkpoint.
  const last = dates.at(-1);
  const targets = [...new Set([...dates, ...Object.keys(checkpoints).map(validDate).filter(date => last && date <= last)])].sort();
  const pending = targets.filter(date => !requiredFiles(date).concat(requiredSidecars(date)).every(path => files.has(path)) ||
    !releaseVerified(release, inventory.sourceCommit, date));
  if (!pending.length) return { action: 'idle', reason: 'no_due_unverified_date' };
  const targetDate = pending[0];
  const base = { targetDate, pendingDates: pending, sourceCommit: inventory.sourceCommit };
  if (leaseActive(lease, now)) return { ...base, action: 'wait', reason: 'active_publisher', owner: lease.owner };
  if (latestRun?.branch === 'main' && latestRun.path === POLICY.workflowPath && ACTIVE.has(latestRun.status)) {
    return { ...base, action: 'wait', reason: 'main_pages_run_in_progress', runId: latestRun.id };
  }
  const missing = requiredFiles(targetDate).filter(path => !files.has(path));
  if (missing.length) return { ...base, action: checkpoints[targetDate] || missing.length < 4 ? 'resume_generation' : 'register_and_generate',
    reason: missing.length === 4 ? 'no_content_commit' : 'partial_content', missing,
    resumeFrom: checkpoints[targetDate]?.stage || 'registered' };
  const sidecars = requiredSidecars(targetDate).filter(path => !files.has(path));
  if (sidecars.length) return { ...base, action: 'resume_generation', reason: 'missing_evidence_or_interviews', missing: sidecars };
  if (!latestRun || latestRun.branch !== 'main' || latestRun.path !== POLICY.workflowPath || latestRun.headSha !== inventory.sourceCommit) {
    return { ...base, action: 'inspect_or_trigger_pages', reason: 'no_current_commit_pages_run' };
  }
  if (latestRun.status !== 'completed') return { ...base, action: 'wait', reason: 'pages_not_completed', runId: latestRun.id };
  if (latestRun.conclusion === 'success') return { ...base, action: 'verify_publication', reason: 'snapshot_or_target_not_yet_verified', runId: latestRun.id };
  if (!failure?.logsRead || failure.runId !== latestRun.id || failure.headSha !== latestRun.headSha) {
    return { ...base, action: 'read_failed_logs', reason: 'exact_run_and_step_evidence_required', runId: latestRun.id };
  }
  const kind = classifyFailure(failure);
  const action = kind === 'transient'
    ? (Number(failure.attempts || 0) < POLICY.maxTransientAttempts ? 'retry_failed_jobs' : 'defer_retry')
    : kind === 'deterministic' ? 'minimal_fix_then_validate'
    : kind === 'conflict' ? 'refresh_and_reconcile'
    : kind === 'permission' ? 'report_permission_blocker' : 'investigate';
  return { ...base, action, reason: kind, runId: latestRun.id };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [command, filename] = process.argv.slice(2);
    if (command !== 'plan' || !filename) throw new Error('Usage: node scripts/daily-publication.mjs plan observation.json');
    console.log(JSON.stringify(planPublication(JSON.parse(readFileSync(filename, 'utf8'))), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
