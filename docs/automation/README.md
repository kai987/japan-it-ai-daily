# Daily scheduling and N1 publication handoff

Effective 2026-09-23. This document supplements docs/daily-publication/README.md without replacing its full content contract. The 10:00 author and any enabled/manual IT recovery read both documents plus scripts/daily-publication.mjs. A user-disabled hourly recovery stays disabled; do not recreate it as part of publication repair. N1 has its own canonical contract at kai987/Japanese-N1-Immersive-Sparring-Partner:docs/automation/README.md and policy.json.


## Request-only upstream publication

Daily authors no longer write the report/evidence/interview paths directly to `main`. After the exact `draft/daily-YYYY-MM-DD` commit passes `deploy.yml`, save the complete source-bound publication request/status to the progress branch, then CAS-write `.github/daily-publication-request.json` on `automation/daily-publish-request`. The request must use the current main SHA as `baseCommit`, the exact green draft commit/run, exactly the six target publication paths, and only explicitly allowlisted platform-repair paths when `platformRepair=true`.

Only `.github/workflows/publish-daily.yml` normally writes those daily paths to `main`. It uses a non-cancelling repository-wide publisher concurrency group, reruns the complete gates, rechecks main before a fast-forward push, and adds the publisher/request commit trailers that `deploy.yml` requires for daily-content changes. While that publisher is queued or running, all author/recovery entrypoints yield and MUST NOT replace the request slot.

## Cheap observation before expensive generation

First confirm Asia/Tokyo, read current main SHA, a complete file inventory, progress/lease and exact current Pages run state. Call the read-only planner with real observations. Include every due calendar date from2026-09-22 and earlier registered pending dates, oldest first. A missing checkpoint is recoverable; failed/truncated reads do not establish missing files. Recovery must not start today's generation before11:00. Active leases, main Pages runs, and `publish-daily.yml` runs wait, not cancel, duplicate, or overwrite their request. Already verified unchanged dates exit before research, drafting or unnecessary Git writes. The hourly task remains an IT publication recovery task, not a new hourly N1 monitor.

Reuse completed source evidence, drafts and validated history only when their recorded source SHA, complete date inventory, identity-rule version/hash and artifact hashes still match. Changed sources/rules/history require the relevant refresh and revalidation. Do not invent a cache, zero-duplicate result or full-history scan; no recent-N-days substitute. All final preflight and main gates remain mandatory. Save real partial progress promptly, preserve original news window and targetDate across midnight, and never publish partial placeholders.

## All upstream writers share one lease

The 10:00 task, IT recovery, N1 sync/recovery and direct related repairs all use automation/daily-progress:locks/publisher.json with claimLease/renewLease/assertLease. Latest blob SHA/CAS, unique token and read-back;45minuteTTL, at least5minute renewal, recheck before EVERY write/promotion. An unreadable or live foreign lease forbids writes. No independent N1 upstream writer, blind overwrite or force push. Release on orderly yield after saving progress; do not hold upstream while waiting for N1 ownership.

## Continue a newly verified publication into N1

Only after exact main deploy.yml, build, final Pages, published byte checks and full sourceCommit-bound study snapshot pass, record upstream published. Then release the upstream lease and attempt ONE corresponding N1 handoff in the same invocation. This is continuation of a newly completed publication, not periodic scanning of N1 backlog. Missing/active N1 inputs remain for existing11:00 and daily12:00 entrypoints.

Read the N1 canonical contract and actual helpers/schema. Confirm the newly published target falls in its plan (2026-08-30 through2026-12-06), its full original n1-source is available or recoverable from its verified source outbox, and no live sync/request will be overwritten. Prepare the complete source-bound N1 request using this exact successful release and verified snapshot. Save completed request/status on automation/n1-progress, then write .github/n1-sync-request.json using the actual connected GitHub write action and latest SHA/CAS. That push invokes the shared sync workflow. Do not introduce another direct final-JSON writer. If the task cannot finish preparation, save actual partial state and precise missing inputs, never a fake ready request.

The receiver validates full source identity, original blob, complete snapshot history, card rules, tests and build before final data commit. Only exact N1 Pages success and live target verification means N1 published. Report upstream and N1 statuses separately: upstream success does not imply N1 success. Same fault/date/result is not repeatedly notified. Never reset learner state or publish private feedback.

## Optional GitHub-native success callback

.github/workflows/notify-n1.yml listens only for completed successful main Deploy Astro site to GitHub Pages runs. It has no cron and executes no checked-out source in its privileged job. It rechecks the exact build/deploy/post-deploy gate, then dispatches N1 sync-n1-daily.yml with the published source_commit as a hint. The N1 receiver replays only an already complete matching request. It cannot generate missing content, combine commits, or turn an old request into a new date.

Configuration requires an explicitly authorized upstream Actions secret N1_SYNC_TOKEN with permission to dispatch workflows in kai987/Japanese-N1-Immersive-Sparring-Partner (target repository Actions:write; grant no unrelated repository access). Do not put credentials in Git, chat or logs. The normal upstream GITHUB_TOKEN is not a cross-repository credential. With no secret, the callback writes callback_unconfigured to the run summary and makes NO dispatch. A successful callback workflow with that summary is NOT a connected handoff. With a dispatch, callback_dispatched is still not final N1 publication. Inspect receiver and final Pages results separately.

Existing connected ChatGPT publication continuation does not require this extra native callback secret. Do not claim the native callback is configured or end-to-end tested merely because this workflow exists. Keep N1 recovery once per day at12:00. Do not create more scheduled tasks to hide a missing credential, and do not recreate an IT hourly recovery schedule that the user has explicitly disabled.

## Completion and failures

Full original-source evidence, independent Chinese/Japanese prose, exact canonical interview mirrors, all detailed teaching fields, full-history new-item dedupe, genuine grammar shortages, review eligibility, frequency denominators and full history are unchanged. Follow the primary runbook in full. Read exact failed logs before repair; three bounded transient attempts, CAS reconciliation for conflicts, no permission bypass, unknown platform causes stay unknown. Code-only deployment or successful configuration change is not a recovered missing daily report. Persist status only in progress branches, not main deployment loops.

## Public lease identity and recurring-task retention

`locks/publisher.json.token` is a **public coordination identifier**, not an authentication credential. For each new claim, generate a fresh UUID locally with `randomUUID()` from `node:crypto` and pass it to the unchanged `claimLease` helper. Preserve that same UUID through CAS write, complete read-back, `assertLease` and `renewLease`. GitHub authorization comes from the connected tool, not this identifier. Never copy a GitHub PAT, OAuth token, Actions secret, cookie, API key, or private user identifier into the lease. The primary runbook's prohibition on storing tokens refers to authentication/session credentials, not this explicitly required, freshly generated public lease identifier.

Do not remove, rename, encode, or omit the `token` field to evade a real tool rejection. Do not weaken the 45-minute TTL, five-minute renewal, latest-blob-SHA/CAS, same-token read-back, foreign-owner exclusion, or checks before every write. An actual denied write remains a blocker. Record the precise tool result; 401/403 require authorization resolution, 409/422 require a fresh read and reconciliation, and an unsupported URL shape is not evidence of repository permission loss. A field named `token`, a generic scheduled-task error, or an earlier assistant explanation alone cannot establish a platform security block. If a fresh authorized write succeeds, report only that the earlier failure was not reproduced; do not invent its historical cause.

Never disable the recurring 10:00 Asia/Tokyo daily task because a run fails, succeeds, yields to an active writer, or has no new work. This includes deterministic failures and genuine permission or platform blockers. Retain the exact target, last complete stage, error evidence and next action where writes are permitted; when no remote write is possible, state that limitation without claiming a saved checkpoint. Suppress unchanged duplicate notifications rather than disabling the schedule. Only an explicit user instruction may stop or change it. The user-disabled hourly IT recovery must remain disabled; do not add replacement schedules.

A lease smoke test or this maintenance repair is not a daily report release. Keep its diagnostic record separate from report publication status. The request-only publisher, all six daily paths, exact-commit preflight, complete quality gates, final Pages/snapshot verification and conditional N1 handoff remain unchanged.
