import { execFileSync } from 'node:child_process';
import { prepareLeaseWrite, verifyLeaseReadBack, assertLease, leaseBlobSha, validateLease, LEASE_POLICY } from './publication-lease.mjs';

export const REPOSITORY = 'kai987/japan-it-ai-daily';
const endpoint = `repos/${REPOSITORY}/contents/${LEASE_POLICY.path}`;
const clock = () => new Date().toISOString();

// One authenticated transport. Do not retry denials or CAS conflicts here.
export function ghJson(args, input, run = execFileSync) {
  return JSON.parse(run('gh', args, { encoding: 'utf8', input, timeout: 30_000, maxBuffer: 8 * 1024 * 1024 }));
}
export function readRemoteLease(api = ghJson) {
  const file = api(['api', `${endpoint}?ref=${LEASE_POLICY.branch}`]);
  if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string') throw new Error('Incomplete remote lease read');
  const content = Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8');
  if (leaseBlobSha(content) !== file.sha) throw new Error('Remote lease blob SHA mismatch');
  validateLease(JSON.parse(content));
  return { complete: true, sha: file.sha, content };
}
export function mutateRemoteLease(options, { api = ghJson, now = clock } = {}) {
  const planned = prepareLeaseWrite({ ...options, observed: readRemoteLease(api), now: now() });
  api(['api', '-X', 'PUT', endpoint, '--input', '-'], JSON.stringify({
    branch: planned.branch, sha: planned.sha, content: Buffer.from(planned.content).toString('base64'),
    message: `chore: ${options.operation} local daily lease ${options.targetDate}`,
  }));
  return verifyLeaseReadBack(planned, readRemoteLease(api), now());
}
export function verifyRemoteOwnership(leaseId, targetDate, { api = ghJson, now = clock } = {}) {
  const observed = readRemoteLease(api);
  // prepareLeaseWrite also verifies the observed blob SHA before interpreting it.
  prepareLeaseWrite({ operation: 'renew', observed, leaseId, targetDate, now: now() });
  const lease = JSON.parse(observed.content);
  assertLease(lease, leaseId, targetDate, now());
  return lease;
}

// Async authoring helpers can use this guard during long research. Always call
// guard.beforeWrite() immediately before each separate checkpoint/draft/request.
export async function withLeaseHeartbeat(options, work, dependencies = {}) {
  const { schedule = setInterval, unschedule = clearInterval } = dependencies;
  let failure = null, busy = false;
  const renew = () => {
    if (failure) throw failure;
    return mutateRemoteLease({ operation: 'renew', targetDate: options.targetDate, leaseId: options.leaseId }, dependencies);
  };
  renew();
  const timer = schedule(() => {
    if (busy || failure) return;
    busy = true;
    try { renew(); } catch (error) { failure = error; } finally { busy = false; }
  }, LEASE_POLICY.renewalMinutes * 60_000);
  timer?.unref?.();
  try {
    const result = await work({ beforeWrite() { renew(); return verifyRemoteOwnership(options.leaseId, options.targetDate, dependencies); } });
    if (failure) throw failure;
    return result;
  } finally { unschedule(timer); }
}
