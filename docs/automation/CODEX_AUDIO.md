# Post-publication AivisSpeech audio

Authorized on 2026-09-29 for the existing local daily task, starting with reports dated 2026-09-30. Audio is now a required follow-up attempt after verified text publication. A failed audio stage leaves the text release available and must be reported as incomplete audio, never as full completion. This does not add another schedule or generate video.

## Scope and recovery

Read this contract, the README audio section, the two generators, the audio validators, and `.github/workflows/sync-r2-audio.yml` before executing. Use the frozen publication `targetDate`, even after midnight or during recovery; never use `--latest`, `--all` or `--force` for the scheduled run. Generate learning words/examples, grammar examples, five interview questions/answers and three review recordings using the existing scripts. Reuse original-date review recordings and valid cached synthesis.

After text publication is verified, record an audio checkpoint before N1 handoff or audio work. Keep per-date JSON under `/Users/paulasmith/.codex/automations/it-ai-codex/audio-progress/`, outside Git and separate from the publication status schema. Record targetDate, text source commit, hashes of the six source paths, stage, audio commit, workflow run IDs, manifest hashes, verification evidence, error and next step. Write atomically via a temporary file and rename. Stages: pending, generated, validated, pushed, r2_verified, pages_verified, playback_verified. Only completed checks advance stages.

On every scheduled run, also inspect incomplete audio checkpoints and published report dates from 2026-09-30 through the real JST date. A missing checkpoint is not success: reconstruct it from actual release/workflow evidence. A text planner `idle` result only skips text generation; resume eligible unfinished audio. Never regenerate an unpublished report, backfill pre-cutover history, or resend N1 merely because audio needs repair. Already verified unchanged source/manifest hashes require no synthesis or upload. A pending audio error must not prevent authoring the next due text report or the independently authorized one-time N1 handoff.

## Start the engine and generate

Check `http://127.0.0.1:10101/version` and `/speakers` with request timeouts. If unavailable, run `open -a AivisSpeech`; poll readiness with a bounded total of 120 seconds and individual waits below 60 seconds. Verify `morioki / ノーマル`, style ID `497929760`. Missing app/model, denied launch, or engine timeout is a recorded failure, not permission to change voices/providers or install a paid service. Use ffmpeg and ffprobe already installed locally.

Run from a complete checkout of the verified published content. Before synthesis, read any existing committed manifests and checkpoint settings. Preserve their validated settings when resuming the same date (for example, 2026-09-29 interview speed is 0.86); do not overwrite them with defaults or trust ambient shell overrides. For a new date without prior settings, set `AIVIS_ENGINE_URL=http://127.0.0.1:10101`, `AIVIS_STYLE_ID=497929760`, `AIVIS_WORD_SPEED=1.00`, `AIVIS_EXAMPLE_SPEED=1.00`, `AIVIS_INTERVIEW_SPEED=1.00` for synthesis and freeze those settings in the checkpoint. For a resumed date, explicitly export the preserved learning word/example speeds and interview speed instead. Replace `DATE` with the frozen target date:

```sh
node scripts/generate-japanese-audio.mjs --date DATE
node scripts/generate-interview-audio.mjs --date DATE
node scripts/validate-interview-audio-duration.mjs --date DATE --write
npm run audio:check
npm run audio:integrity:check
npm run audio:versions:check
npm run audio:duration:check
```

Stop on the first failed command. Explicitly require both target-date manifests, the expected voice and frozen per-date settings, complete text mappings and referenced nonempty MP3s; integrity checks alone allow dates with no recordings. Keep current duration gates (ideal 24–34 seconds, hard 22–40); never change prose, timing thresholds, speed or manifest text just to pass. If a referenced historical recording is missing, record the exact dependency instead of following the generator's generic `--all` recovery suggestion.

## Publish audio through the existing workflow

Release the text-author lease before this separate stage. Fetch main again and inspect active author/publisher, main Pages and R2 runs before committing or pushing; yield while another writer or deployment owns the slot. Preserve user edits and migration documents. If an isolated checkout is needed, reuse a suitable attached checkout or use the managed worktree tool. Do not reset/stash user work. Recheck the six source hashes against latest main; source drift invalidates the audio and requires regeneration against the verified current text.

The user authorizes a separate audio-only commit and normal push to main after validation. Stage only `public/audio/japanese/DATE/` and genuinely required SHA-256 reference updates in existing review manifests. The generators synchronize byte versions across dates: inspect all changes and exclude unrelated historical changes. Do not include any of the six content paths, unrelated edits, migration docs, credentials, or a fake publisher trailer. If a cached generator rerun only changes JSON key order, preserve the original committed bytes after proving parsed JSON and referenced MP3 hashes are identical; do not publish an empty or formatting-only audio update. Confirm changed paths before push. If main advances, refresh/rebase safely, recheck source hashes and rerun affected gates; never force-push. Repository branch protections or denied access remain blockers.

Wait for the exact audio commit's `.github/workflows/sync-r2-audio.yml` and `.github/workflows/deploy.yml`. Use workflow dispatch only when a run did not trigger or for a justified retry, verifying the actual run's head SHA; do not duplicate a running workflow. R2 uploads use existing GitHub secrets, not extracted local credentials. The existing workflow uploads changed recordings, verifies public SHA-256 bytes and repairs only confirmed remote drift. Keep its cleanup allowlist unchanged. A green text-only R2 run before the audio commit does not prove audio upload.

## Verify public playback and finish

Require exact-commit R2 success and its nonzero target audio verification scope, plus exact-commit Pages build/deploy/post-deploy success. Verify public manifests against the audio commit and check target recordings, including referenced review audio, through `scripts/verify-audio-integrity.mjs --remote --changed-file PATH`. PATH is a NUL-delimited path list containing both target manifests (and any dependent changed audio paths); use the deployed `PUBLIC_AUDIO_BASE_URL`, not an assumed endpoint. Confirm a nonzero selected recording count. Fetch immutable hash-named MP3s and compare full bytes, not just HTTP status.

Use the release artifact and `scripts/verify-deployment.mjs` to verify live report/snapshot bytes for the audio commit. Open the deployed Chinese and Japanese daily and learning pages in a browser. Test at least one interview answer, one word/example, one grammar example when present, and reused review audio when present, covering both languages. Confirm the player requests the expected R2 hash-named URL, duration is finite and playback time advances; browser TTS fallback or a successful HEAD request is not recorded-audio playback proof. If browser access is unavailable, retain `pages_verified` and report playback unverified.

Persist actual evidence and stage after each step. Transient failures get at most three attempts; authorization denials are not retried through another transport. Preserve recordings and resume upload/verification without resynthesizing unchanged text. Report text, audio/R2/playback and N1 outcomes separately. Do not mark audio complete until playback_verified; keep the existing daily schedule active for recovery, without enabling hourly recovery.
