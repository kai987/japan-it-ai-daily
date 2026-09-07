# Japanese history repair

The current acceptance standard is [Daily Content Quality Rules](../DAILY_CONTENT_QUALITY_RULES.md), together with [Interview Audio Duration Calibration](../INTERVIEW_AUDIO_DURATION_CALIBRATION.md). The August 13–September 6 repair uses the same accepted September 7 A + B + C layout. August 12 and September 7 are unchanged by this pass.

## Source and language boundary

Original Top 5 articles are the source of facts. Chinese frontmatter supplies article identity and order, original URLs, and the learning skeleton. Chinese article prose is never a source for Japanese generation. Chinese and Japanese explanations are independently composed from the originals; the five Japanese interview questions and answers are shared verbatim, with the canonical text in `daily`. The previous Chinese read-only and `interviewSource: originals` exception described an earlier repair stage and is superseded for the accepted dates by the current rules.

Each explanation retains source-supported background, mechanisms, experimental conditions, results, limitations, and a relevant interview application. Vendor claims, forecasts, single-account experiments, and editorial suggestions are distinguished. Missing or member-only source text is not reconstructed from its title. Public primary supplements are linked and recorded separately. Current source retrieval does not claim to reproduce an immutable historical snapshot.

The four content collections remain aligned by date. Japanese lesson descriptions are written in Japanese; vocabulary and grammar identity and example text match the Chinese structured lesson. Learning examples and projects are identified as teaching material, not quotations or documented deployments.

## Date batches

| Date | State |
| --- | --- |
| 2026-08-12 | Previously accepted; see [editorial review](2026-08-12-editorial-review.md) |
| 2026-08-13–2026-09-06 | All 25 dates regenerated from 125 originals; source, validation, and publication evidence in the [range manifest](2026-08-13_2026-09-06.json) |
| 2026-09-07 | Layout reference; unchanged |

See the [range editorial review](2026-08-13_2026-09-06-editorial-review.md) for evidence boundaries and corrections. Source snapshots and drafting scratch files are kept outside the repository; the manifest records source hashes or public-browser review evidence. Publication status is recorded independently of content completion.

## Validation

Historical dates must be selected explicitly because the default quality gate begins on September 8:

```sh
node scripts/validate-daily-quality.mjs --date=2026-08-13
INTERVIEW_ACTUAL_DURATION_FROM=2026-08-13 node scripts/validate-interview-audio-duration.mjs --date 2026-08-13
npm run bilingual:check-interview
npm run check
npm run audio:check
npm test
npm run build
npm run security:check
```

Repeat the two dated checks for every accepted date through September 6. Check that both modes use exactly the text in each audio manifest; verify actual MP3 duration at the existing voice and speed, without changing acceptance thresholds. The range includes 125 answers and 325 question, answer, and review recordings. Existing vocabulary and grammar recordings retain exact-text alignment.

After pushing to `main`, verify the matching Pages and audio deployment runs, rendered Chinese and Japanese answers, and deployed audio bytes. Automated gates establish structure, synchronization, and duration; they do not replace original-source review or spoken-language judgment.
