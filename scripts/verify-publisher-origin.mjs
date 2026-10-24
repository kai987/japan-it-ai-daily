import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fullGitSha, gitBaselineIsAncestor, latestSuccessfulWorkflowRun, readSuccessfulWorkflowRuns } from './workflow-success-baseline.mjs';

export const PUBLISHER_TRAILER = 'Daily-Publisher: .github/workflows/publish-daily.yml';
export const BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';

const publicationPatterns = [
  /^src\/content\/(?:daily|daily-ja|japanese|japanese-ja)\/\d{4}-\d{2}-\d{2}\.md$/,
  /^src\/content\/evidence\/\d{4}-\d{2}-\d{2}\.json$/,
  /^src\/data\/interviews\/\d{4}-\d{2}-\d{2}\.json$/,
];

export function isDailyPublicationPath(path) {
  return publicationPatterns.some((pattern) => pattern.test(path));
}

export function verifyPublisherOrigin({ changedPaths, message, authorEmail }) {
  if (!Array.isArray(changedPaths) || changedPaths.some((path) => typeof path !== 'string')) {
    throw new Error('changedPaths must be a string array');
  }
  const publicationPaths = changedPaths.filter(isDailyPublicationPath);
  if (!publicationPaths.length) return { publicationPaths: [], enforced: false };
  if (authorEmail !== BOT_EMAIL) throw new Error('Daily publication paths may only be committed by github-actions[bot]');
  const lines = String(message || '').split(/\r?\n/).map((line) => line.trim());
  if (!lines.includes(PUBLISHER_TRAILER)) throw new Error('Daily publication commit is missing the publisher trailer');
  const requestLines = lines.filter((line) => line.startsWith('Publication-Request: '));
  if (requestLines.length !== 1 || requestLines[0].slice('Publication-Request: '.length).trim().length < 8) {
    throw new Error('Daily publication commit must contain exactly one Publication-Request trailer');
  }
  return { publicationPaths, enforced: true };
}

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

export function publisherRangeFromEvent({ eventName, event, ref, head, repository, baselineRun }) {
  if (!fullGitSha(head)) throw new Error('An exact checkout SHA is required');
  if (ref !== 'refs/heads/main' || event?.repository?.full_name !== repository || !repository) {
    throw new Error('Publisher verification requires observed main ref and repository metadata');
  }
  if (eventName === 'push') {
    if (event.ref !== ref || event.after !== head || event.deleted || event.forced) {
      throw new Error('Push ref/after metadata does not describe this main checkout');
    }
    if (!fullGitSha(event.before) || event.before === head) throw new Error('Push before must be a distinct existing full commit SHA');
    return { base: event.before, head, source: 'push-before' };
  }
  if (eventName !== 'workflow_dispatch') throw new Error('Unsupported publisher verification event');
  const requestedHead = event.inputs?.source_commit;
  if (requestedHead && (!fullGitSha(requestedHead) || requestedHead !== head)) {
    throw new Error('Dispatched source_commit does not match the exact main workflow SHA');
  }
  // Dispatch has no event.before. Use a real completed main release observation,
  // not HEAD^ (which would miss an earlier direct write) or all legacy history.
  if (!baselineRun || !fullGitSha(baselineRun.head_sha) || baselineRun.status !== 'completed' || baselineRun.conclusion !== 'success'
    || baselineRun.head_branch !== 'main' || baselineRun.path !== '.github/workflows/deploy.yml'
    || baselineRun.head_repository?.full_name !== repository) {
    throw new Error('Dispatch requires a completed successful main deployment baseline');
  }
  return { base: baselineRun.head_sha, head, source: 'completed-main-deployment' };
}

export function verifyPublisherRange({ base, head, root = process.cwd() }) {
  if (!fullGitSha(base) || !fullGitSha(head) || !gitBaselineIsAncestor(base, head, root)) {
    throw new Error('Publisher range requires available commits and a main ancestor baseline');
  }
  const commits = git(root, 'rev-list', '--reverse', '--topo-order', `${base}..${head}`).split(/\r?\n/).filter(Boolean);
  const verified = [];
  for (const commit of commits) {
    const parents = git(root, 'rev-list', '--parents', '-n', '1', commit).split(/\s+/).slice(1);
    if (!parents.length) throw new Error(`Cannot verify publisher origin for root commit ${commit}`);
    // Every introduced side-branch commit is also in rev-list. Daily changes
    // entering main through a merge still require the unique publisher. If
    // old main is the second parent, compare to it rather than mistaking its
    // already published history for a new side-branch publication.
    const mainParents = parents.length > 1 ? parents.filter((parent) => gitBaselineIsAncestor(base, parent, root)) : parents;
    const parent = mainParents.length === 1 ? mainParents[0] : parents[0];
    const args = ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', parent, commit];
    const changedPaths = execFileSync('git', args, { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    try {
      verified.push({ commit, ...verifyPublisherOrigin({ changedPaths, message: git(root, 'log', '-1', '--format=%B', commit),
        authorEmail: git(root, 'log', '-1', '--format=%ae', commit) }) });
    } catch (error) { throw new Error(`${commit}: ${error.message}`); }
  }
  return { commits: verified, enforced: verified.filter((entry) => entry.enforced).length };
}

export async function verifyPublisherEvent(env = process.env, { root = process.cwd(), readRuns = readSuccessfulWorkflowRuns } = {}) {
  if (!env.GITHUB_EVENT_PATH) throw new Error('GITHUB_EVENT_PATH is required; missing push/dispatch observations cannot authorize publication');
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  const head = git(root, 'rev-parse', 'HEAD');
  if (env.GITHUB_SHA !== head) throw new Error('Workflow SHA does not match the checked out commit');
  let baselineRun;
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    const runs = await readRuns({ repository: env.GITHUB_REPOSITORY, workflowPath: '.github/workflows/deploy.yml', token: env.GH_TOKEN });
    baselineRun = latestSuccessfulWorkflowRun(runs, { repository: env.GITHUB_REPOSITORY,
      workflowPath: '.github/workflows/deploy.yml', currentRunId: env.GITHUB_RUN_ID });
  }
  const range = publisherRangeFromEvent({ eventName: env.GITHUB_EVENT_NAME, event, ref: env.GITHUB_REF, head,
    repository: env.GITHUB_REPOSITORY, baselineRun });
  return { ...range, ...verifyPublisherRange({ ...range, root }) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await verifyPublisherEvent();
    console.log(`Verified publisher ownership across ${result.commits.length} introduced commit(s), ${result.enforced} daily publication commit(s); ${result.source}: ${result.base}..${result.head}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
