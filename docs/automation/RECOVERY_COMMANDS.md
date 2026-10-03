# Local recovery commands

These commands implement the repeatable local portions of [CODEX_LOCAL.md](CODEX_LOCAL.md) and [CODEX_AUDIO.md](CODEX_AUDIO.md). They do not author news, promote the six daily paths to main, upload directly to R2, trigger N1, or configure a schedule. The original-source and unique-publisher contracts remain required.

## Inspect without writing

Prepare the complete, authenticated observation specified in CODEX_LOCAL.md: main inventory, all text checkpoints, exact Pages/job/live snapshot verification, publisher state and failure logs when applicable. Store it outside Git, without credentials or raw source captures.

```sh
npm run daily:resume -- plan --observation /absolute/outside-repo/observation.json
```

The command uses the real current JST clock, fetches main without changing the checkout, rejects observations bound to an older main SHA, reads the full main tree, and refreshes the shared lease plus active publisher/main Pages/R2 runs. Missing or truncated reads are errors. The existing text planner still selects the earliest due date. Audio is inspected independently for published dates from 2026-09-30, even when text is idle. Frozen source and manifest hashes, actual referenced MP3 bytes and recorded R2/Pages/playback evidence distinguish unchanged completion from an incomplete stage. A missing audio checkpoint is work to inspect, never success.

## Local audio only

Once the exact text publication is verified, freeze one eligible date:

```sh
npm run daily:resume -- audio-local --date YYYY-MM-DD \
  --observation /absolute/outside-repo/observation.json
```

Default progress is `/Users/paulasmith/.codex/automations/it-ai-codex/audio-progress/`. `--state-dir` may select another directory outside the repository; `--root` may select a complete checkout. Writes use a per-date exclusive lock, compare the previously read checkpoint bytes, fsync a temporary file, rename and read back exact bytes. If a process dies while holding a `.lock`, inspect the process and checkpoint before removing the stale lock; do not delete a live runner's lock.

The runner persists pending before synthesis, probes/starts AivisSpeech with a two-minute limit, verifies morioki / ノーマル 497929760, and exports frozen speeds explicitly. Existing manifest/checkpoint settings must agree; new dates default to 1.00. The generators receive only `--date`, followed by actual duration writes and unchanged script/integrity/version/duration gates. Live coordination and six source hashes against freshly fetched main are rechecked before each phase. Partial generation remains recoverable through the generators' verified cache. A generated checkpoint skips synthesis and resumes validation; a validated or later checkpoint routes to its remaining remote stage.

Failures retain the last completed stage and exact failed phase/log outside Git. Read and resolve that failure before clearing `error` with the atomic checkpoint helper; do not erase evidence merely to retry. The runner does not retry authorization denials or switch transports. Frozen date, source commit/hashes, settings and createdAt cannot be overwritten, nor can stages or timestamps move backwards. Source drift requires a reviewed recovery against newly verified text, not an automatic rebaseline.

`validated` is local validation only. Review the audio-only Git diff, refresh coordination/main and source hashes, then follow CODEX_AUDIO.md for the separately authorized normal push and exact-commit R2/Pages/live-byte/playback verification. Do not infer remote completion from this command's exit code. Audio and text checkpoints remain independent; an audio failure does not discard published text or repeat N1.

## Existing versioned author lease

Explicit operations use the existing schemaVersion 2 helper, one `gh` transport, fresh blob SHA/CAS and exact read-back:

```sh
npm run daily:resume -- lease --operation claim --date YYYY-MM-DD --owner codex-local-daily
npm run daily:resume -- lease --operation renew --date YYYY-MM-DD --lease-id UUID
npm run daily:resume -- lease --operation release --date YYYY-MM-DD --lease-id UUID --reason completed-or-yielded
```

Claim after inspecting actual coordination under the authoring contract. Claims retain the 45-minute TTL. Async authoring integrations may import `withLeaseHeartbeat` from `scripts/local-publication-lease.mjs`: it renews immediately and every five minutes, surfaces renewal failure, and exposes `guard.beforeWrite()` for fresh renewal/ownership verification before each checkpoint, draft or request. A failed renewal forbids subsequent writes. The helper does not grant publication authority, cancel a publisher or discard a legacy lease. Release the author lease before the separate audio stage.

`npm run daily:runtime:check` checks these entry points and the remote comparison/origin helpers. Unit tests exercise conflicts, byte drift, missing evidence, frozen settings and active-writer yielding; CI retains the full content/audio/browser/publication gates.
