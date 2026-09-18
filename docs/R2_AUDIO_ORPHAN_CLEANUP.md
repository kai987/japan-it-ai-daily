# R2 audio orphan cleanup

The R2 bucket mirrors the managed audio tree under `public/audio/japanese/`.

## Policy

The sync workflow always verifies local audio mappings and public MP3 SHA-256 hashes before orphan cleanup.

After verification it lists R2 objects and compares them with the current Git tree.

Two classes are handled differently:

1. **Safe legacy review recordings** — R2-only files matching:
   - `review-vocab-XX.mp3`
   - `review-example-XX.mp3`
   - `review-grammar-example-XX.mp3`

   These filenames belong to the retired per-review-day recording scheme. Current review cards reuse the first-introduced `vocab-XX.mp3`, `example-XX.mp3`, and `grammar-example-XX.mp3`. If a legacy review file is absent from Git but still exists in R2, the workflow deletes it automatically.

2. **Other R2-only objects** — these are reported in the GitHub Actions step summary but are **not automatically deleted**. They require explicit review before any broader cleanup rule is introduced.

The workflow also fails if a managed local audio file is missing from R2.

## Safety boundaries

Automatic deletion is intentionally restricted to:

`japanese/YYYY-MM-DD/review-vocab-NN.mp3`

`japanese/YYYY-MM-DD/review-example-NN.mp3`

`japanese/YYYY-MM-DD/review-grammar-example-NN.mp3`

The shell step checks the key again immediately before deletion. Unknown prefixes, manifests, interview recordings, review-question recordings, and any other R2-only files are audit-only.

## Local audit helper

The comparison logic lives in `scripts/audit-r2-audio-orphans.mjs`.

Given an AWS `list-objects-v2` JSON result:

```bash
node scripts/audit-r2-audio-orphans.mjs \
  --remote /tmp/r2-objects.json \
  --report /tmp/r2-orphans.json \
  --safe-list /tmp/r2-safe-prune.txt
```

Use `--require-no-safe-orphans` after deletion and `--fail-on-missing` when the remote mirror must contain every managed local file.
