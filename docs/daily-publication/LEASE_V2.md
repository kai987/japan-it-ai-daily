# Versioned public author lease

This is a data-model and validation upgrade, NOT a remedy for a platform-denied write. A field rename cannot establish the cause of a safety rejection or guarantee acceptance. Do not retry a rejected operation with renamed/encoded fields, another transport or an alternate execution environment. Resolve genuine platform/permission blockers through the supported approval or support channel. No helper here grants GitHub permissions.

## Scope and unchanged invariants

One existing lock: `automation/daily-progress:locks/publisher.json`. No new writer, lock branch, cron, secrets, or permissions. All IT authors, manual repairs and N1 upstream repairs continue sharing it. New records have `schemaVersion: 2` and `leaseId` (fresh lowercase UUID v4). IDs are public ownership markers, not authentication or monotonically increasing database fencing counters. The cooperating-writer/CAS protocol is not a cross-file distributed transaction.

TTL stays 45 minutes. Renew after checkpoints and at least every 5 minutes. Re-read and assert immediately before EACH checkpoint/draft/request write. Observe active publisher and main Pages runs; yield, never cancel or overwrite their request. Keep the 10:00 Asia/Tokyo schedule enabled and hourly IT recovery disabled. The six publication paths, request-only publisher, allowlist, all content/tests/browser/CSP gates, final exact-commit Pages/snapshot verification, and conditional N1 handoff are unchanged.

## Helper API

```js
import {
  claimLease, renewLease, assertLease, releaseLease, leaseIdentity, validateLease,
} from './scripts/daily-publication.mjs';

// previous must be the current, fully read lease. Only a verified initial
// absence may be represented by null; never convert an error/403 to null.
const next = claimLease(previous, { owner, targetDate, now });
const leaseId = leaseIdentity(next); // helper generated it with node:crypto
// A fresh randomUUID() may also be passed as the explicit leaseId option.

// After the actual authorized CAS write and complete read-back:
assertLease(readBack, leaseId, targetDate, verifiedCurrentTime);
const renewed = renewLease(readBack, leaseId, nextCurrentTime);
// Use the same authorized CAS/read-back protocol for renewed, not direct overwrite.
const released = releaseLease(latestReadBack, leaseId, releaseTime, 'orderly_yield');
```

Validate required types, version, UUID, dates/timezones, timestamp order, maximum TTL and release consistency. Unknown v2 fields, both identity fields, unknown versions, absent IDs and malformed timestamps fail closed. Clock rollback, expired ownership, wrong identity/target and immediate previous-ID reuse fail closed. `releaseLease` expires only a currently owned lease and retains its record. An expired worker cannot release another owner's lock.

`lease.schema.json` is the structural schema. Runtime `validateLease` also enforces temporal relationships that ordinary JSON Schema cannot express. Passing either is NOT proof of remote ownership.

## Legacy compatibility and deployment sequence

A record with absent/1 schemaVersion and `token` is legacy. Historical IDs were not all UUIDs; the reader recognizes these identifiers. Never treat a legacy lock as missing, never force-reset it, and never rewrite historical status/artifacts. Live legacy ownership blocks all other claims. A legitimate legacy owner can renew/release in its original schema without changing its identity. Only a new claim after an actual release/expiry adopts v2. New claims reject the old `token` argument; callers must use the new API, not silently reinterpret an old secret-like argument.

Deploy as a reviewed code-only maintenance change, separately from daily content. Before ANY remote maintenance write, follow the currently deployed lease and authorization contract; if that acquisition is blocked, keep the patch local and stop remote mutation. Do not use this patch itself to bootstrap around a blocked lease.

Review all `claimLease`, `renewLease`, `assertLease` and direct lock-field call sites in scripts, tests, docs and workflow/automation prompts. Upgrade IT 10:00 and N1 11:00/daily-12:00 upstream-repair callers to the same current helper. Preserve all non-lease content and publication requirements. Old workers must fail closed on an unrecognized v2 lock. Do not persist both `token` and `leaseId` to accommodate old workers. Do not roll back to legacy-only helpers while a v2 tenure remains live. Do not change actual `GITHUB_TOKEN`, PAT/OAuth/API credentials or Actions secrets.

The JSON schema describes lease records only; publication-request and status schema versions do not change. Existing frozen targetDate/sourceWindow, completed artifact hashes and request slots must not be rewritten by migration.

## Exact CAS preparation and read-back

The optional CLI is deliberately read-only; it reads a local JSON file and prints a plan or verification result. It never calls GitHub, discovers credentials, writes Git refs or modifies schedules.

Prepare `observation.json` with `operation` (`claim`, `renew`, or `release`), actual timezone-qualified `now`, `targetDate`, and `observed: { complete: true, sha, content }`. `content` is the full raw UTF-8 string returned by the real lock read, and `sha` its actual Git blob SHA. Claim additionally needs `owner` and optionally a freshly generated `leaseId`; renew/release need the identity already held, and release needs a public `reason`. Do not fabricate observations. A failed/truncated/mismatched read cannot be made `complete` by setting the flag. The helper validates the byte-level Git blob hash too.

```sh
node scripts/publication-lease.mjs plan /tmp/observation.json
```

`prepareLeaseWrite` returns `operation`, the fixed `branch` and `path`, the OLD `sha`, the complete proposed `content`, and `expectedBlobSha`. Through an already authorized GitHub contents action, supply the old `sha` as the CAS condition. This plan is not a write, lease acquisition, permission grant or retry instruction. If denied, stop; 409/422 requires a fresh read and reconciliation, not reuse of the payload or a force write. At most three evidenced transient retries follow the existing runbook. Unknown safety causes remain unknown. Do not store raw private tool output in public checkpoints.

Read the lock back completely. Prepare `verification.json` with `planned` (the unchanged returned plan), `observed` (the actual read-back shape), and actual current `now`:

```sh
node scripts/publication-lease.mjs verify /tmp/verification.json
```

`verifyLeaseReadBack` requires exact UTF-8 bytes, exact expected Git blob SHA, known scope/version and still-live ownership for claim/renew. For release it verifies the exact expired/released record. Re-read/assert again before the next content/checkpoint operation; a previous successful verification is not an indefinite authorization.

## Regression and release verification

The existing workflow command includes `lease.cases.mjs` through `recovery.node.mjs`; no workflow permissions or gates are edited:

```sh
node --test tests/publication/recovery.node.mjs tests/publication/request.node.mjs tests/publication/publisher-origin.node.mjs
```

Cases include v1/v2 exclusion, invalid/dual IDs, UUID generation in a fresh Node process, malformed and incomplete observations, exact 45-minute TTL, time rollback, stale workers, expiry boundary, release consistency, target mismatch, simulated concurrent CAS, UTF-8 Git hashing and exact read-back. A simulated CAS test is not a live GitHub CAS test.

Run the remaining unchanged type/content/history/evidence/interview/quality/audio/unit/build/speech-smoke/browser/CSP gates in the authorized environment and verify the exact final main Pages deployment. Locally passing these lease tests is only component validation; do not label a maintenance patch, CLI plan or code-only release as today's published IT report or N1 handoff.
