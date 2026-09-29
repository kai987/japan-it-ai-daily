# Codex local authoring and manual trial

## Migration status and scope

The rules and validation-only trial were prepared on 2026-09-29. Later that day, the user explicitly requested scheduler cutover for the next daily report. A local Codex heartbeat is now ACTIVE in the existing repository chat at daily 10:00 Asia/Tokyo, with its first allowed production date 2026-09-30. The old ChatGPT “日本 IT/AI 日报” was paused and its UI showed “一時停止中” with a resume button. N1 schedules and the disabled hourly IT recovery were not changed.

The active task uses publish mode and the full contract below. Preserve local user changes when fetching main and preparing a complete-tree daily draft. Keep rule-maintenance commits separate from the six-path daily content publication. Scheduler configuration is maintained through the Codex app, not by editing repository Markdown or automation TOML. A successful scheduler cutover does not establish that the first new-day Codex generation has already passed.

The original task delegates its full contract to this repository. Its old `token` lease wording is superseded here by the deployed v2 helper contract (`leaseId`); do not copy the old claim signature. No private conversation export or scheduler identifier is needed in Git.

## Required reading on every authoring run

1. `AGENTS.md`, this file, `docs/automation/NEWS_SOURCES.md`, `docs/daily-publication/README.md`, `docs/automation/README.md`, `docs/daily-publication/LEASE_V2.md` and `lease.schema.json`.
2. `docs/DAILY_CONTENT_QUALITY_RULES.md`, `docs/daily-quality-policy.json`, `src/content.config.ts` and `scripts/validate-daily-quality.mjs`.
3. `docs/evidence/README.md`, `scripts/source-evidence.mjs`, `scripts/validate-source-evidence.mjs`.
4. `docs/structured-interview-policy.json`, `scripts/structured-interview.mjs`, `scripts/render-interview-sections.mjs`.
5. `docs/learning-review/README.md`, `scripts/learning-review.mjs`, `docs/jlpt-history/identity-rules.json`, `docs/grammar-history/identity-rules.json` and their history validators.
6. `scripts/daily-publication.mjs`, `scripts/publication-lease.mjs`, `scripts/daily-publisher.mjs`, `.github/workflows/deploy.yml`, `.github/workflows/publish-daily.yml`, `package.json`.

Follow current user instructions first. The publication runbook's later new/review rules supersede the older fixed new-item quotas. Use current validators and workflows for executable gates; contradictions must be disclosed, not resolved by weakening a check. This migration does not waive any source review or gate.

## Source selection and editorial contract

- Freeze the target date and window: normally previous day 10:00 through target day 10:00 JST. Preserve a genuine window already checkpointed, including across midnight. Do not use later news as a backdated source.
- Exclude the previous report's Top 5. Keep the two languages' Top 5 identity/order and original Japanese titles consistent. Read originals and record access scope, dates, mechanisms, APIs, conditions, results and limitations.
- Use the user's complete 20-source list in [NEWS_SOURCES.md](NEWS_SOURCES.md), recovered from the conversation supplied during migration. Do not confuse a recorded list with a completed daily source scan; record actual discovery and access evidence each day.
- Preserve full A+B+C: four-category overview; five detailed article explanations; five article-aligned Japanese Q&A with projects/keywords; detailed technical theme; three review questions. B has 2–4 points per Top article, without new articles or duplicated interviews.
- Each detailed explanation develops background, mechanisms, evidence type, conditions, results and limits in complete paragraphs. Do not pad unsupported detail. Distinguish source facts, interpretations and teaching examples in evidence.
- Author canonical interview JSON once, render both mirrors, and check exact strings. Each answer retains at least two verifiable article-specific anchors and a real boundary; natural spoken Japanese takes priority over generic enterprise jargon. Use current estimated and measured duration gates (default ideal 24–34 seconds, hard 22–40), not character quotas. Do not change thresholds to pass.
- Enumerate all earlier dates of all four collections, record source commit and coverage, then apply lexical/grammar identity normalization plus semantic review. New vocabulary aims at 20 but must be genuine; shared review fills toward 20. New grammar can be zero; new plus review aims at 5–8 with truthful shortage notes. C-4 is only up to ten new words and up to five new grammar items. Preserve every detailed card field and natural Japanese explanations.
- Use the unchanged learning-review module for review eligibility, frequencies, first introductions and issue numbers. No recent-N-days shortcut or historical edits to conceal duplicates. Keep source captures outside Git; only concise evidence and actual capture hashes belong in the public repository.

## Local prerequisites

Use Node 24 and lockfile-compatible dependencies (`npm ci` when needed), Git, authenticated GitHub access, and Playwright Chromium. GitHub read access is enough for this trial; a successful read does not prove future write permission. A scheduled local run later requires the Mac awake, connected, and the Codex app running; the schedule was enabled separately by the user-authorized cutover.

From 2026-09-30, the scheduled publish task must attempt the post-publication AivisSpeech workflow in [CODEX_AUDIO.md](CODEX_AUDIO.md): start the local engine, generate the frozen target date, validate, publish audio to R2 through the existing workflow, and verify deployed playback. Audio failure preserves the text release but leaves audio incomplete and recoverable; it is no longer an optional task step. Trial mode still does not synthesize or publish recordings.

## Modes and startup

### trial (explicit validation-only request)

Read remote state and run local validation. Do not write a remote lease/checkpoint/draft/request, push, deploy or change schedules. Existing content and recordings remain unchanged. If generation is necessary for a trial, use an isolated local checkout; keep uncommitted user work intact. Never falsify an earlier date or the clock to make the planner generate.

### publish (explicitly requested real daily execution)

Use the existing author lease, persistent progress and publisher contract in full. The local tool transport can be authenticated Git/`gh` or an available connector; a denied operation remains a blocker and must not be retried through another transport to evade it.

### Observe before acting

1. Read actual JST time, `git status`, current branch and HEAD; `git fetch origin`. Fast-forward only a clean compatible checkout. Keep migration changes and daily output out of each other's publication commits.
2. Read the full `origin/main` file inventory, progress tree and every registered `status.json`, lock content/blob SHA, request content/blob SHA, active publisher and latest main Pages runs. Paginate remote reads and reject truncated trees; 403 is not absence.
3. Verify the current successful main run's build, deploy and post-deploy jobs. Download its `it-study-snapshot` and Pages artifact; compare sourceCommit, date coverage, totalDays, issueNumbers and full grammarLessons against the repository. Verify public snapshot and both report bytes with `scripts/verify-deployment.mjs` using expectations derived from the artifact, never from the public response itself.
4. Assemble real observations for the existing read-only planner:

   ```sh
   node scripts/daily-publication.mjs plan /tmp/publication-observation.json
   ```

   Include actual `now`, `mode: "daily"`, complete inventory/sourceCommit, all checkpoints, lease, latestRun, publisherRun and release evidence. Field names are defined by `planPublication`/`releaseVerified`; never populate success fields before the corresponding checks pass.
5. Respect the returned action. An unchanged verified date is `idle`, not a reason to regenerate text. Before ending a publish run, inspect and resume eligible post-cutover audio checkpoints under CODEX_AUDIO.md, including missing checkpoints for verified published dates. A live lease or active run yields; an incomplete observation requires inspection. If production generation is due, claim before long research, freeze the target/window and checkpoint each verified portion. Renew the 45-minute v2 lease at least every five minutes and before each write; verify latest-SHA CAS and exact-byte read-back.

## Authoring, validation and publication

New-day output consists of the four Markdown paths plus `src/content/evidence/DATE.json` and `src/data/interviews/DATE.json`. These six paths are defined by `requiredPublishPaths`; use current schemas rather than a historical file as an unchecked template. Chinese files are writable for a new bilingual date; they remain read-only in Japanese-only history repair and audio-only tasks.

Run the existing gates, retaining command, exit code and log path. These commands do not publish:

```sh
node --test tests/publication/recovery.node.mjs tests/publication/request.node.mjs tests/publication/publisher-origin.node.mjs
npm run check
npm run content:integrity:check
npm run evidence:check
npm run evidence:pilot
npm run bilingual:check-interview
npm run quality:check
npm run audio:check
npm run audio:versions:check
npm test
npm run build
npm run test:browser:speech-smoke
npm run test:browser
npm run security:check
```

New source capture review additionally requires `npm run evidence:check -- --date DATE --source-dir /absolute/outside-repo/originals`. Recorded audio requires `audio:integrity:check` and `audio:duration:check`. A schema check without original captures does not establish quote-byte or semantic verification. The actual `deploy.yml` also audits dependencies; preserve its full gates for every production draft and main release.

For production, base `draft/daily-DATE` on the **complete** current main tree. Check ancestry and `git diff --name-status BASE...DRAFT`: only the six target paths, plus any explicitly allowed platform repair, may differ; no repository-wide deletions. Run exact-commit draft preflight. Save `preflight_passed`/`request_ready` checkpoints, re-read lease/main/request/active publisher, then CAS-write the complete source-bound request. Only `publish-daily.yml` promotes content to main. An active publisher owns the slot; never replace it or directly promote daily paths.

When GitHub writes originate from `GITHUB_TOKEN`, do not assume push will start another workflow: follow the existing explicit dispatch mechanism and verify an actual exact-head run. Publisher success is not Pages success. Verify final main's complete deploy, public byte hashes and snapshot before recording `published` on the progress branch.

Only a newly verified publication can trigger the existing one-time N1 handoff. First release the upstream lease, read the N1 repository's current canonical contract, verify full original n1-source/outbox and request ownership, and prepare its source-bound request. N1 request, final commit, Pages and live date are separate outcomes. An idle trial does not initiate N1 sync.

After verified text publication, persist the audio checkpoint and execute [CODEX_AUDIO.md](CODEX_AUDIO.md). Audio and the one-time N1 handoff have independent outcomes: failure in either must not skip the other. Do not claim complete audio from text-only Pages success.

## Trial record and cutover criteria

Store a concise record under `docs/automation/trials/`: observed time, source commit, mode, planner result, inventory coverage, actual run/artifact references, local checks, warnings and untested operations. Keep raw logs/captures outside Git. Hash the four content directories, evidence, interviews and audio before/after to prove a validation-only trial did not rewrite content.

A published-date trial proves startup, read access, duplicate avoidance, local gates and existing release verification. It does **not** prove fresh-source selection/authoring, a live lease write, a new draft/request, fresh publisher execution, audio synthesis or N1 handoff. Record these explicitly; do not call it an end-to-end new-day release. The user has explicitly authorized cutover after this validation-only trial; the first 2026-09-30 production run must exercise the untested generation/publication steps with all existing gates enforced. Keep exactly one primary author enabled and report the actual result, including any precise blocker. Do not bypass checks because the schedule is enabled.
