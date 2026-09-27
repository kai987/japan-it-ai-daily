import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Public coordination data, NOT authentication. All functions and CLI commands
// are local/pure: no GitHub client, credential discovery, network, or Git writes.
// A tool denial must be resolved, not retried through a renamed field/transport.
export const LEASE_POLICY = Object.freeze({
  schemaVersion: 2, leaseMinutes: 45, renewalMinutes: 5,
  branch: 'automation/daily-progress', path: 'locks/publisher.json',
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA = /^[0-9a-f]{40}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;
const V2_FIELDS = new Set(['schemaVersion', 'leaseId', 'owner', 'targetDate',
  'acquiredAt', 'updatedAt', 'expiresAt', 'releasedAt', 'releaseReason']);
const has = (o, key) => Object.hasOwn(o, key);
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
}
function text(value, name, limit = 256) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(`Invalid ${name}`); // Never echo untrusted field values.
  }
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid targetDate');
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Invalid targetDate');
}
function instant(value) {
  if (typeof value !== 'string' || !STAMP.test(value)) throw new Error('Invalid timezone-qualified lease timestamp');
  date(value.slice(0, 10));
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('Invalid lease timestamp');
  return time;
}
function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error('leaseId must be a lowercase UUID v4');
}
function idOf(lease) {
  return lease.schemaVersion === 2 ? lease.leaseId : lease.token;
}

/** Validate without mutating or converting a live/expired legacy record. */
export function validateLease(lease) {
  object(lease, 'Malformed lease');
  const version = has(lease, 'schemaVersion') ? lease.schemaVersion : 1;
  if (version !== 1 && version !== 2) throw new Error('Unsupported lease schemaVersion');
  text(lease.owner, 'lease owner', 160);
  date(lease.targetDate);
  if (version === 2) {
    if (has(lease, 'token')) throw new Error('Ambiguous lease: v2 must not contain token');
    for (const key of Object.keys(lease)) if (!V2_FIELDS.has(key)) throw new Error('Unexpected v2 lease field');
    if (!has(lease, 'leaseId')) throw new Error('Malformed lease: leaseId required');
    uuid(lease.leaseId);
  } else {
    if (has(lease, 'leaseId')) throw new Error('Ambiguous lease: legacy record must not contain leaseId');
    // Older deployed records used non-UUID IDs. Do not pretend they are absent.
    text(lease.token, 'legacy coordination identifier');
  }
  const acquired = instant(lease.acquiredAt), updated = instant(lease.updatedAt), expires = instant(lease.expiresAt);
  if (acquired > updated || updated > expires) throw new Error('Inconsistent lease timestamps');
  if (expires - updated > LEASE_POLICY.leaseMinutes * 60_000) throw new Error('Lease TTL exceeds policy');
  if (has(lease, 'releasedAt')) {
    const released = instant(lease.releasedAt);
    if (released !== updated || released !== expires) throw new Error('Inconsistent lease release timestamps');
  }
  if (has(lease, 'releaseReason')) {
    text(lease.releaseReason, 'release reason', 512);
    if (!has(lease, 'releasedAt')) throw new Error('Release reason requires releasedAt');
  }
  return lease;
}
export function leaseIdentity(lease) {
  return idOf(validateLease(lease));
}
export function leaseActive(lease, now) {
  const current = instant(now);
  // Only use null after a verified absence; a failed read is never null.
  if (lease === null) return false;
  validateLease(lease);
  if (instant(lease.updatedAt) > current) throw new Error('Lease clock moved backwards; inspect before writing');
  return !has(lease, 'releasedAt') && instant(lease.expiresAt) > current;
}
export function claimLease(lease, options) {
  object(options, 'Lease claim options');
  if (has(options, 'token')) throw new Error('Legacy claim API retired; upgrade the caller before a new claim');
  for (const key of Object.keys(options)) if (!['owner', 'leaseId', 'targetDate', 'now'].includes(key)) {
    throw new Error('Unexpected lease claim option');
  }
  const { owner, targetDate, now } = options;
  text(owner, 'lease owner', 160); date(targetDate);
  const time = instant(now);
  if (leaseActive(lease, now)) throw new Error('Another live publisher owns the lease');
  // An omitted ID is generated by Node, not an assumed global crypto object.
  const leaseId = has(options, 'leaseId') ? options.leaseId : randomUUID();
  uuid(leaseId);
  if (lease !== null && idOf(lease) === leaseId) throw new Error('A new claim must not reuse the previous lease identity');
  return validateLease({ schemaVersion: LEASE_POLICY.schemaVersion, leaseId, owner, targetDate,
    acquiredAt: now, updatedAt: now, expiresAt: new Date(time + LEASE_POLICY.leaseMinutes * 60_000).toISOString() });
}
export function assertLease(lease, expectedLeaseId, targetDate, now) {
  text(expectedLeaseId, 'expected lease identity'); date(targetDate);
  if (!leaseActive(lease, now) || idOf(lease) !== expectedLeaseId || lease.targetDate !== targetDate) {
    throw new Error('Lost or expired publication lease; do not write');
  }
}
export function renewLease(lease, expectedLeaseId, now) {
  assertLease(lease, expectedLeaseId, lease?.targetDate, now);
  // Finish a legitimate legacy owner's tenure in its ORIGINAL schema. Never
  // rename a live record or keep both IDs. New claims alone adopt v2.
  return validateLease({ ...lease, updatedAt: now,
    expiresAt: new Date(instant(now) + LEASE_POLICY.leaseMinutes * 60_000).toISOString() });
}
export function releaseLease(lease, expectedLeaseId, now, reason) {
  assertLease(lease, expectedLeaseId, lease?.targetDate, now);
  text(reason, 'release reason', 512);
  return validateLease({ ...lease, updatedAt: now, expiresAt: now, releasedAt: now, releaseReason: reason });
}
export function leaseBlobSha(content) {
  if (typeof content !== 'string') throw new Error('Lease content must be UTF-8 text');
  const bytes = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
function observedLease(observed) {
  object(observed, 'Complete lease observation');
  if (observed.complete !== true || typeof observed.sha !== 'string' || !SHA.test(observed.sha) ||
      typeof observed.content !== 'string' || leaseBlobSha(observed.content) !== observed.sha) {
    throw new Error('Complete lease content and matching Git blob SHA required');
  }
  let lease;
  try { lease = JSON.parse(observed.content); } catch { throw new Error('Invalid lease JSON'); }
  return validateLease(lease);
}

/** Prepare one contents-API CAS payload. This does NOT perform/authorize a write. */
export function prepareLeaseWrite(input) {
  object(input, 'Lease write input');
  const { operation, observed, now, owner, targetDate, leaseId, reason } = input;
  const allowed = operation === 'claim'
    ? ['operation', 'observed', 'now', 'owner', 'targetDate', 'leaseId']
    : operation === 'renew' ? ['operation', 'observed', 'now', 'targetDate', 'leaseId']
    : operation === 'release' ? ['operation', 'observed', 'now', 'targetDate', 'leaseId', 'reason'] : [];
  if (!allowed.length) throw new Error('Unsupported lease operation');
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error('Unexpected lease write input');
  const previous = observedLease(observed);
  let next;
  if (operation === 'claim') {
    const options = { owner, targetDate, now };
    if (has(input, 'leaseId')) options.leaseId = leaseId;
    next = claimLease(previous, options);
  } else {
    assertLease(previous, leaseId, targetDate, now);
    next = operation === 'renew' ? renewLease(previous, leaseId, now) : releaseLease(previous, leaseId, now, reason);
  }
  const content = `${JSON.stringify(next, null, 2)}\n`;
  return { operation, branch: LEASE_POLICY.branch, path: LEASE_POLICY.path,
    sha: observed.sha, content, expectedBlobSha: leaseBlobSha(content) };
}

/** Verify exact bytes/SHA AND current ownership following an authorized CAS. */
export function verifyLeaseReadBack(planned, observed, now) {
  object(planned, 'Planned lease mutation');
  if (!['claim', 'renew', 'release'].includes(planned.operation) ||
      planned.branch !== LEASE_POLICY.branch || planned.path !== LEASE_POLICY.path ||
      typeof planned.sha !== 'string' || !SHA.test(planned.sha)) throw new Error('Invalid planned lease mutation');
  const actual = observedLease(observed);
  if (observed.content !== planned.content || observed.sha !== planned.expectedBlobSha ||
      planned.expectedBlobSha !== leaseBlobSha(planned.content)) throw new Error('Lease read-back does not match the planned CAS');
  if (planned.operation === 'release') {
    if (!has(actual, 'releasedAt') || leaseActive(actual, now)) throw new Error('Lease release was not verified');
  } else {
    if (planned.operation === 'claim' && actual.schemaVersion !== 2) throw new Error('New claims require lease schema v2');
    assertLease(actual, idOf(actual), actual.targetDate, now);
  }
  return actual;
}

// Read-only CLI: input/output are local artifacts, never execution evidence.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [command, filename, ...extra] = process.argv.slice(2);
    if (!['plan', 'verify'].includes(command) || !filename || extra.length) {
      throw new Error('Usage: node scripts/publication-lease.mjs <plan|verify> input.json');
    }
    let input;
    try { input = JSON.parse(readFileSync(filename, 'utf8')); }
    catch { throw new Error('Cannot read a valid lease input JSON file'); }
    const result = command === 'plan' ? prepareLeaseWrite(input)
      : { verified: Boolean(verifyLeaseReadBack(input.planned, input.observed, input.now)), operation: input.planned.operation };
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
