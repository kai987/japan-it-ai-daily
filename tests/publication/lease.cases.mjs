import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LEASE_POLICY, validateLease, leaseIdentity, leaseActive, claimLease,
  assertLease, renewLease, releaseLease, leaseBlobSha, prepareLeaseWrite,
  verifyLeaseReadBack } from '../../scripts/publication-lease.mjs';

// Imported by recovery.node.mjs, so existing deploy AND publisher commands run
// these cases without modifying either workflow or its permissions.
const date = '2026-09-27', now = '2026-09-27T14:00:00+09:00';
const next = '2026-09-27T14:05:00+09:00', later = '2026-09-27T14:46:00+09:00';
const owner = 'lease-unit-test';
const fresh = (extra = {}) => claimLease(null, { owner, targetDate: date, now, ...extra });
const legacy = (extra = {}) => ({ owner, token: 'legacy-coordination-id', targetDate: date,
  acquiredAt: now, updatedAt: now, expiresAt: '2026-09-27T14:45:00+09:00', ...extra });
const snapshot = (lease) => {
  const content = `${JSON.stringify(lease, null, 2)}\n`;
  return { complete: true, sha: leaseBlobSha(content), content };
};
const expired = () => legacy({ acquiredAt: '2026-09-26T14:00:00+09:00',
  updatedAt: '2026-09-26T14:00:00+09:00', expiresAt: '2026-09-26T14:45:00+09:00' });
const plan = (extra = {}) => prepareLeaseWrite({ operation: 'claim',
  observed: snapshot(expired()), owner, targetDate: date, now, ...extra });
const roundtrip = value => JSON.parse(JSON.stringify(value));
const file = (relative) => new URL(relative, import.meta.url);

test('new claims are versioned and generate UUIDs using Node crypto', () => {
  const a = fresh(), b = fresh();
  assert.equal(a.schemaVersion, 2);
  assert.match(a.leaseId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a.leaseId, b.leaseId);
  assert.equal(Object.hasOwn(a, 'token'), false);
  assert.equal(LEASE_POLICY.leaseMinutes, 45);
  assert.equal(LEASE_POLICY.renewalMinutes, 5);
  assert.equal(Date.parse(a.expiresAt) - Date.parse(now), 45 * 60_000);
});
test('bad v2 IDs including explicit undefined, blank and non-v4 UUIDs are rejected', () => {
  for (const leaseId of [undefined, null, '', 123, {}, 'ordinary-string', 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
    '11111111-1111-1111-8111-111111111111']) assert.throws(() => fresh({ leaseId }));
});
test('old claim signatures and unrecognised options must be upgraded, not silently reinterpreted', () => {
  assert.throws(() => fresh({ token: 'old-id' }), /Legacy claim API retired/);
  assert.throws(() => fresh({ ttl: 600 }), /Unexpected lease claim option/);
});
test('live legacy records, including non-UUID IDs, keep their ownership', () => {
  const l = legacy(), before = roundtrip(l);
  assert.equal(validateLease(l), l);
  assert.equal(leaseIdentity(l), l.token);
  assert.equal(leaseActive(l, now), true);
  assert.throws(() => claimLease(l, { owner: 'other', targetDate: date, now }), /live publisher/);
  assert.deepEqual(l, before);
});
test('explicit legacy version 1 is compatible', () => {
  const l = legacy({ schemaVersion: 1 });
  assert.doesNotThrow(() => assertLease(l, l.token, date, now));
});
test('legacy renew/release preserve their original schema, ID and metadata', () => {
  const l = legacy({ diagnostic: 'existing public metadata' });
  const renewed = renewLease(l, l.token, next);
  assert.equal(renewed.token, l.token);
  assert.equal(Object.hasOwn(renewed, 'leaseId'), false);
  assert.equal(Object.hasOwn(renewed, 'schemaVersion'), false);
  assert.equal(renewed.diagnostic, l.diagnostic);
  const released = releaseLease(renewed, renewed.token, next, 'orderly_yield');
  assert.equal(released.token, l.token);
  assert.equal(leaseActive(released, next), false);
  assert.equal(released.releasedAt, released.expiresAt);
});
test('only a fresh claim after expiry adopts v2 and never rewrites its input', () => {
  const l = legacy(), before = roundtrip(l);
  const n = claimLease(l, { owner: 'next-author', targetDate: date, now: later });
  assert.equal(n.schemaVersion, 2);
  assert.equal(Object.hasOwn(n, 'token'), false);
  assert.deepEqual(l, before);
  assert.throws(() => renewLease(n, l.token, later));
});
test('same owner cannot steal its active lease or reuse its expired ID', () => {
  const l = fresh();
  assert.throws(() => claimLease(l, { owner, targetDate: date, now }));
  assert.throws(() => claimLease(l, { owner, targetDate: date, leaseId: l.leaseId, now: later }), /reuse/);
});
test('unknown, null, string schema versions and dual-ID records fail closed', () => {
  const l = fresh();
  for (const schemaVersion of [0, 3, '2', null, undefined]) assert.throws(() => validateLease({ ...l, schemaVersion }));
  assert.throws(() => validateLease({ ...l, token: l.leaseId }), /Ambiguous/);
  assert.throws(() => validateLease(legacy({ leaseId: randomUUID() })), /Ambiguous/);
});
test('unknown v2 fields cannot be persisted by renewal', () => {
  const l = fresh();
  assert.throws(() => renewLease({ ...l, credential: 'not-real-unit-test-data' }, l.leaseId, now), /Unexpected/);
});
test('bad records are not mistaken for expired or absent leases', () => {
  for (const l of [undefined, {}, [], '', 0, false]) {
    assert.throws(() => leaseActive(l, now));
    assert.throws(() => claimLease(l, { owner, targetDate: date, now }));
  }
  assert.equal(leaseActive(null, now), false);
});
test('missing required v2 fields fail closed', () => {
  for (const key of ['schemaVersion', 'leaseId', 'owner', 'targetDate', 'acquiredAt', 'updatedAt', 'expiresAt']) {
    const l = fresh(); delete l[key];
    assert.throws(() => validateLease(l));
  }
});
test('nonexistent dates, unzoned and overflowing timestamps are rejected', () => {
  for (const targetDate of ['2026-02-30', '2026-9-27', '']) assert.throws(() => fresh({ targetDate }));
  for (const value of ['2026-09-27T14:00:00', '2026-02-30T14:00:00Z', '2026-09-27T24:00:00Z', '2026-09-27T14:60:00Z']) {
    assert.throws(() => fresh({ now: value }));
  }
});
test('claim, assert, renew, release reject a backwards clock', () => {
  const l = fresh(), before = '2026-09-27T13:59:59+09:00';
  assert.throws(() => claimLease(l, { owner, targetDate: date, now: before }), /backwards/);
  assert.throws(() => assertLease(l, l.leaseId, date, before), /backwards/);
  assert.throws(() => renewLease(l, l.leaseId, before), /backwards/);
  assert.throws(() => releaseLease(l, l.leaseId, before, 'yield'), /backwards/);
});
test('too-long TTL or contradictory release timestamps cannot pass', () => {
  const l = fresh();
  assert.throws(() => validateLease({ ...l, expiresAt: '2026-09-27T14:45:01+09:00' }), /TTL/);
  assert.throws(() => validateLease({ ...l, releasedAt: now }), /release timestamps/);
  assert.throws(() => validateLease({ ...l, releaseReason: 'yield' }), /releasedAt/);
  assert.throws(() => validateLease({ ...l, acquiredAt: next }), /Inconsistent/);
});
test('renewal preserves identity, target and acquiredAt, and adds exactly 45 minutes', () => {
  const l = fresh(), n = renewLease(l, l.leaseId, next);
  for (const key of ['schemaVersion', 'leaseId', 'targetDate', 'owner', 'acquiredAt']) assert.equal(n[key], l[key]);
  assert.equal(Date.parse(n.expiresAt) - Date.parse(next), 45 * 60_000);
  assert.notEqual(n, l);
});
test('expiry is exclusive: old workers cannot assert, renew or release at the boundary', () => {
  const l = fresh(), end = l.expiresAt;
  assert.equal(leaseActive(l, end), false);
  assert.throws(() => assertLease(l, l.leaseId, date, end));
  assert.throws(() => renewLease(l, l.leaseId, end));
  assert.throws(() => releaseLease(l, l.leaseId, end, 'yield'));
  assert.doesNotThrow(() => claimLease(l, { owner, targetDate: date, now: end }));
});
test('wrong target and wrong identity cannot assert, renew or release', () => {
  const l = fresh(), wrong = randomUUID();
  assert.throws(() => assertLease(l, l.leaseId, '2026-09-28', now));
  assert.throws(() => assertLease(l, wrong, date, now));
  assert.throws(() => renewLease(l, wrong, now));
  assert.throws(() => releaseLease(l, wrong, now, 'yield'));
});
test('release is verifiable, immutable, and does not revive a finished tenure', () => {
  const l = fresh(), r = releaseLease(l, l.leaseId, next, 'publisher_takeover_confirmed');
  assert.equal(r.updatedAt, next); assert.equal(r.expiresAt, next); assert.equal(r.releasedAt, next);
  assert.equal(r.leaseId, l.leaseId); assert.equal(leaseActive(r, next), false);
  assert.equal(leaseActive(l, next), true);
  assert.throws(() => renewLease(r, r.leaseId, next));
  assert.throws(() => releaseLease(r, r.leaseId, next, 'again'));
  assert.doesNotThrow(() => claimLease(r, { owner, targetDate: date, now: next }));
});
test('malformed public owner/reason values are rejected without echoing input', () => {
  assert.throws(() => fresh({ owner: ' ' }));
  assert.throws(() => fresh({ owner: 'x'.repeat(161) }));
  const l = fresh();
  for (const reason of ['', 'line1\nline2', 'x'.repeat(513), 1]) assert.throws(() => releaseLease(l, l.leaseId, now, reason));
});
test('Git blob hashing counts UTF-8 bytes, independently matches git hash-object', () => {
  const content = '日本語の公開協調レコード\n';
  const actual = execFileSync('git', ['hash-object', '--stdin'], { input: content, encoding: 'utf8' }).trim();
  assert.equal(leaseBlobSha(content), actual);
});
test('CAS plan is bound to the exact old blob, fixed branch/path and exact new bytes', () => {
  const observed = snapshot(expired()), p = plan({ observed }), n = JSON.parse(p.content);
  assert.equal(p.sha, observed.sha);
  assert.equal(p.branch, 'automation/daily-progress'); assert.equal(p.path, 'locks/publisher.json');
  assert.equal(p.expectedBlobSha, leaseBlobSha(p.content)); assert.equal(n.schemaVersion, 2);
  assert.notEqual(p.expectedBlobSha, p.sha);
});
test('failed, missing, truncated and mismatched reads never produce CAS payloads', () => {
  const good = snapshot(expired());
  for (const observed of [undefined, null, {}, { ...good, complete: false }, { ...good, sha: 'a'.repeat(40) },
    { ...good, content: good.content.slice(0, -4) }, { ...good, sha: 'abc' }]) assert.throws(() => plan({ observed }));
});
test('a hashed non-object or malformed JSON still cannot qualify as an observation', () => {
  for (const content of ['null', '[]', '{}', 'not-json']) assert.throws(() => plan({
    observed: { complete: true, sha: leaseBlobSha(content), content },
  }));
});
test('CAS preparation rejects unsupported operations, paths and mistaken ID names', () => {
  assert.throws(() => plan({ operation: 'force' }), /Unsupported/);
  assert.throws(() => plan({ path: 'other.json' }), /Unexpected/);
  assert.throws(() => plan({ token: randomUUID() }), /Unexpected/);
});
test('CAS renew/release require the original target in addition to matching ID', () => {
  const l = fresh();
  for (const operation of ['renew', 'release']) assert.throws(() => prepareLeaseWrite({
    operation, observed: snapshot(l), now: next, targetDate: '2026-09-28', leaseId: l.leaseId,
    ...(operation === 'release' ? { reason: 'yield' } : {}),
  }));
});
test('exact successful CAS read-back passes for claim, renew and release', () => {
  let p = plan(), n = JSON.parse(p.content);
  assert.deepEqual(verifyLeaseReadBack(p, snapshot(n), now), n);
  for (const operation of ['renew', 'release']) {
    p = prepareLeaseWrite({ operation, observed: snapshot(n), targetDate: date, leaseId: n.leaseId,
      now: next, ...(operation === 'release' ? { reason: 'yield' } : {}) });
    n = JSON.parse(p.content);
    assert.deepEqual(verifyLeaseReadBack(p, snapshot(n), next), n);
  }
});
test('read-back of a different ID, stale blob, or altered byte sequence fails', () => {
  const p = plan(), n = JSON.parse(p.content);
  assert.throws(() => verifyLeaseReadBack(p, snapshot({ ...n, leaseId: randomUUID() }), now), /does not match/);
  assert.throws(() => verifyLeaseReadBack(p, snapshot(expired()), now), /does not match/);
  const content = JSON.stringify(n);
  assert.throws(() => verifyLeaseReadBack(p, { complete: true, sha: leaseBlobSha(content), content }, now), /does not match/);
});
test('a successful-looking read-back after expiry does not grant ownership', () => {
  const p = plan(), n = JSON.parse(p.content);
  assert.throws(() => verifyLeaseReadBack(p, snapshot(n), later), /expired/);
});
test('invalid expected mutation scope and falsified SHA cannot verify', () => {
  const p = plan(), observed = snapshot(JSON.parse(p.content));
  for (const extra of [{ operation: 'unknown' }, { path: 'different.json' }, { branch: 'main' },
    { expectedBlobSha: 'a'.repeat(40) }, { sha: 'abc' }]) assert.throws(() => verifyLeaseReadBack({ ...p, ...extra }, observed, now));
});
test('simulated concurrent CAS claims: second writer conflicts and cannot assert first ownership', () => {
  const initial = snapshot(expired());
  const a = plan({ observed: initial }), b = plan({ observed: initial });
  let server = initial;
  const cas = p => {
    if (p.sha !== server.sha) throw new Error('409 conflict');
    server = snapshot(JSON.parse(p.content)); return server;
  };
  verifyLeaseReadBack(a, cas(a), now);
  assert.throws(() => cas(b), /409 conflict/);
  assert.throws(() => verifyLeaseReadBack(b, server, now), /does not match/);
  assert.throws(() => assertLease(JSON.parse(server.content), JSON.parse(b.content).leaseId, date, now));
});
test('schema documents v2 plus non-destructive legacy compatibility', () => {
  const schema = JSON.parse(readFileSync(file('../../docs/daily-publication/lease.schema.json'), 'utf8'));
  assert.equal(schema.$defs.v2.properties.schemaVersion.const, 2);
  assert.equal(schema.$defs.v2.additionalProperties, false);
  assert.ok(schema.$defs.v2.required.includes('leaseId'));
  assert.equal(schema.$defs.v2.properties.token, undefined);
  assert.ok(schema.$defs.legacy.required.includes('token'));
});
test('read-only CLI plan works in a fresh Node process without a global crypto assumption', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lease-cli-'));
  try {
    const input = join(dir, 'input.json');
    writeFileSync(input, JSON.stringify({ operation: 'claim', observed: snapshot(expired()), owner, targetDate: date, now }));
    const out = spawnSync(process.execPath, [fileURLToPath(file('../../scripts/publication-lease.mjs')), 'plan', input], { encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    assert.equal(JSON.parse(JSON.parse(out.stdout).content).schemaVersion, 2);
    assert.equal(readFileSync(input, 'utf8').includes('expectedBlobSha'), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('read-only CLI verify succeeds and unsupported commands fail without echoing JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lease-cli-'));
  try {
    const cli = fileURLToPath(file('../../scripts/publication-lease.mjs')), input = join(dir, 'input.json'), p = plan();
    writeFileSync(input, JSON.stringify({ planned: p, observed: snapshot(JSON.parse(p.content)), now }));
    const ok = spawnSync(process.execPath, [cli, 'verify', input], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stderr); assert.equal(JSON.parse(ok.stdout).verified, true);
    const bad = spawnSync(process.execPath, [cli, 'push', input], { encoding: 'utf8' });
    assert.notEqual(bad.status, 0); assert.equal(bad.stdout, '');
    writeFileSync(input, 'malformed-private-value');
    const malformed = spawnSync(process.execPath, [cli, 'plan', input], { encoding: 'utf8' });
    assert.notEqual(malformed.status, 0); assert.equal(malformed.stderr.includes('malformed-private-value'), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
