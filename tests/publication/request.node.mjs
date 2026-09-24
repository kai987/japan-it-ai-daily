import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicationRequest, requestedPaths, requiredPublishPaths, PLATFORM_REPAIR_ALLOWLIST } from '../../scripts/daily-publisher.mjs';

const date = '2026-09-25';
const shaA = 'a'.repeat(40);
const shaB = 'b'.repeat(40);
const base = {
  schemaVersion: 1,
  requestId: 'daily-2026-09-25-bbbbbbbb',
  targetDate: date,
  requestedAt: '2026-09-25T10:42:00+09:00',
  baseCommit: shaA,
  draftBranch: `draft/daily-${date}`,
  draftCommit: shaB,
  preflightRunId: 12345,
  preflightWorkflowPath: '.github/workflows/deploy.yml',
  files: requiredPublishPaths(date),
  platformRepair: false,
  platformRepairPaths: [],
};

test('valid request contains exactly the six publication paths', () => {
  const value = validatePublicationRequest(base);
  assert.deepEqual(value.files, requiredPublishPaths(date));
  assert.deepEqual(requestedPaths(value), requiredPublishPaths(date));
});

test('missing or extra publication paths fail closed', () => {
  assert.throws(() => validatePublicationRequest({ ...base, files: base.files.slice(1) }));
  assert.throws(() => validatePublicationRequest({ ...base, files: [...base.files, 'README.md'] }));
});

test('draft branch must be bound to targetDate', () => {
  assert.throws(() => validatePublicationRequest({ ...base, draftBranch: 'draft/daily-2026-09-24' }));
  assert.throws(() => validatePublicationRequest({ ...base, draftBranch: 'feature/daily-2026-09-25' }));
});

test('platform repairs need an explicit flag and strict allowlist', () => {
  assert.throws(() => validatePublicationRequest({ ...base, platformRepairPaths: [PLATFORM_REPAIR_ALLOWLIST[0]] }));
  const repaired = validatePublicationRequest({
    ...base, platformRepair: true, platformRepairPaths: [PLATFORM_REPAIR_ALLOWLIST[0]],
  });
  assert.equal(requestedPaths(repaired).at(-1), PLATFORM_REPAIR_ALLOWLIST[0]);
  assert.throws(() => validatePublicationRequest({
    ...base, platformRepair: true, platformRepairPaths: ['.github/workflows/deploy.yml'],
  }));
});

test('bad SHAs, workflow identities, run ids and timestamps fail closed', () => {
  assert.throws(() => validatePublicationRequest({ ...base, baseCommit: 'abc' }));
  assert.throws(() => validatePublicationRequest({ ...base, preflightWorkflowPath: '.github/workflows/other.yml' }));
  assert.throws(() => validatePublicationRequest({ ...base, preflightRunId: 0 }));
  assert.throws(() => validatePublicationRequest({ ...base, requestedAt: '2026-09-25T10:42:00' }));
});
