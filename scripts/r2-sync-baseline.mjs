import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fullGitSha, gitBaselineIsAncestor, latestSuccessfulWorkflowRun, readSuccessfulWorkflowRuns } from './workflow-success-baseline.mjs';

export const R2_WORKFLOW_PATH = '.github/workflows/sync-r2-audio.yml';

export function selectR2SyncBaseline({ eventName, head, runs, repository, currentRunId, isAncestor = gitBaselineIsAncestor }) {
  if (!fullGitSha(head)) throw new Error('The R2 checkout must have an observed full Git SHA');
  if (eventName === 'workflow_dispatch' || eventName === 'schedule') {
    return { base: '', runId: '', reason: 'manual-or-weekly-full-audit' };
  }
  if (eventName !== 'push') throw new Error('Unsupported R2 workflow event');
  const run = latestSuccessfulWorkflowRun(runs, { repository, workflowPath: R2_WORKFLOW_PATH, currentRunId });
  if (!run) return { base: '', runId: '', reason: 'no-completed-success-full-audit' };
  if (!isAncestor(run.head_sha, head)) return { base: '', runId: '', reason: 'unavailable-or-nonancestor-full-audit' };
  return { base: run.head_sha, runId: String(run.id), reason: 'last-completed-success' };
}

export async function observeR2SyncBaseline(env = process.env, { readRuns = readSuccessfulWorkflowRuns, root = process.cwd() } = {}) {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_SHA !== head) throw new Error('R2 event ref/SHA does not match the main checkout');
  let runs;
  if (env.GITHUB_EVENT_NAME === 'push') {
    try {
      runs = await readRuns({ repository: env.GITHUB_REPOSITORY, workflowPath: R2_WORKFLOW_PATH, token: env.GH_TOKEN });
    } catch (error) {
      // Failure to observe a trusted baseline widens the audit; it must never
      // substitute event.before and silently omit an earlier failed batch.
      console.warn(`R2 baseline unavailable; using full audit: ${error.message}`);
      return { base: '', runId: '', reason: 'baseline-read-failed-full-audit' };
    }
  }
  return selectR2SyncBaseline({ eventName: env.GITHUB_EVENT_NAME, head, runs, repository: env.GITHUB_REPOSITORY,
    currentRunId: env.GITHUB_RUN_ID, isAncestor: (base, current) => gitBaselineIsAncestor(base, current, root) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV is required');
    const result = await observeR2SyncBaseline();
    appendFileSync(process.env.GITHUB_ENV, `R2_SYNC_BASE=${result.base}\nR2_BASELINE_RUN_ID=${result.runId}\nR2_BASELINE_REASON=${result.reason}\n`);
    console.log(`R2 comparison: ${result.reason}${result.base ? `; run ${result.runId}, ${result.base}..HEAD` : ''}.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
