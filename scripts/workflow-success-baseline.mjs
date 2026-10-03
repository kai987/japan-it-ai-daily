import { execFileSync } from 'node:child_process';

export const fullGitSha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) && !/^0+$/.test(value);

// Read every page, not just the newest push: an older run may have completed
// successfully on a later retry. The API's filtered-search cap is 1,000 runs.
export async function readSuccessfulWorkflowRuns({ repository, workflowPath, token, fetchImpl = fetch, apiUrl = 'https://api.github.com' }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || '')) throw new Error('A GitHub repository observation is required');
  if (!/^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(workflowPath || '')) throw new Error('Invalid workflow path');
  if (apiUrl !== 'https://api.github.com') throw new Error('Unsupported GitHub API origin');
  if (!token) throw new Error('GitHub Actions read token is required');
  const runs = new Map();
  let expectedCount;
  for (let page = 1; page <= 10; page += 1) {
    const filename = workflowPath.split('/').at(-1);
    const url = `${apiUrl}/repos/${repository}/actions/workflows/${filename}/runs?branch=main&status=success&per_page=100&page=${page}`;
    const response = await fetchImpl(url, {
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2026-03-10' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Workflow baseline read failed (HTTP ${response.status})`);
    const body = await response.json();
    if (!Number.isSafeInteger(body.total_count) || body.total_count < 0 || !Array.isArray(body.workflow_runs)) {
      throw new Error('Incomplete workflow baseline response');
    }
    expectedCount = Math.max(expectedCount ?? 0, body.total_count);
    if (expectedCount > 1000) throw new Error('Workflow baseline observation exceeds the API search cap');
    for (const run of body.workflow_runs) {
      if (!Number.isSafeInteger(run?.id) || run.id <= 0) throw new Error('Workflow run is missing its identity');
      runs.set(run.id, run);
    }
    if (runs.size >= expectedCount) return [...runs.values()];
    if (!body.workflow_runs.length) throw new Error('Workflow baseline pagination is incomplete');
  }
  throw new Error('Workflow baseline pagination did not complete');
}

export function latestSuccessfulWorkflowRun(runs, { repository, workflowPath, currentRunId } = {}) {
  if (!Array.isArray(runs)) throw new Error('Workflow run observations are required');
  const candidates = runs.filter((run) => run?.status === 'completed' && run.conclusion === 'success'
    && Number.isSafeInteger(run.id) && run.id > 0
    && run.head_branch === 'main' && run.path === workflowPath
    && run.head_repository?.full_name === repository
    && String(run.id) !== String(currentRunId)
    && fullGitSha(run.head_sha) && Number.isFinite(Date.parse(run.updated_at)));
  candidates.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at) || b.id - a.id);
  return candidates[0] || null;
}

export function gitBaselineIsAncestor(base, head, root = process.cwd()) {
  if (!fullGitSha(base) || !fullGitSha(head)) return false;
  try {
    execFileSync('git', ['cat-file', '-e', `${base}^{commit}`], { cwd: root, stdio: 'ignore' });
    execFileSync('git', ['merge-base', '--is-ancestor', base, head], { cwd: root, stdio: 'ignore' });
    return true;
  } catch { return false; }
}
