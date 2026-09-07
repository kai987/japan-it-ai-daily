# Japanese history repair

Use the Japanese September 7 daily and structured lesson as layout references only. Do not modify September 7. Work on `repair/japanese-history-from-originals` in ascending date order.

## Content boundary

`src/content/daily` and `src/content/japanese` remain read-only. Extract only Top 5 identity fields and the learning skeleton from frontmatter; never use Chinese summaries or Markdown bodies to write Japanese prose. Generate article explanations directly from the original linked articles. Preserve article order and URLs. Mark learning examples and editorial interview/project suggestions as teaching material, not quotations or documented product behavior.

`prepare-source-direct-context.py` stops reading at the frontmatter delimiter and exports an allowlist. `generate-source-direct-structured.py` now blocks all model requests if any original is unavailable or too short; it does not substitute title-based prose. Fetched articles are no longer silently truncated. Recheck the actual article identity and content before accepting output: HTTP success and length alone are not editorial verification.

## Date batches

| Date | State |
| --- | --- |
| 2026-08-12 | Re-expanded from five originals to September 7 detail; see 2026-08-12-editorial-review.md for retained facts and corrected claims |
| 2026-08-13–2026-09-06 | Pending this repair pass |
| 2026-09-07 | Reference only; unchanged |

The date manifest records source snapshot hashes, the immutable template ref, and output hashes. Source text and drafting scratch files are outside the repository under `/tmp/source-direct-ja/2026-08-12`. The August 12 rewrite uses the currently retrievable article text, including the hooks article's later addendum; it does not claim to reconstruct an immutable August 12 snapshot.

## Validation

```sh
python3 -m unittest discover -s scripts -p test_source_direct.py
python3 scripts/validate-source-direct-output.py --date 2026-08-12 --workdir /tmp/source-direct-ja/2026-08-12
npm test
npm run build
git diff --exit-code HEAD -- src/content/daily src/content/japanese
```

The daily C section is rendered from the same structured lesson data to keep terms, counts, definitions, and examples consistent. Markdown two-space hard line breaks follow the September 7 layout intentionally. Existing Japanese schema fields remain intact. The grammar skeleton spelling `動詞ます形去ます` is normalized in the Japanese output to `動詞ます形から「ます」を取る` without changing the construction.

The article generator no longer requests a 2–4 sentence digest. It requests source-supported background, mechanisms, conditions, results and limits, and provides a larger response budget. Missing experimental evidence must be identified rather than invented. Output still requires an editorial review; token budgets and automated checks do not establish factual completeness.

## Interview answer standard

Use the article specificity and spoken Japanese of `1b4b0b0` as the baseline, adding a relevant enterprise-level question or decision where useful. Each answer keeps at least one or two distinctive mechanisms, conditions, or findings from its own article. Follow conclusion → concrete article detail → practical judgment without turning that order into a repeated script. Prefer familiar Japanese except for necessary product/API names. Questions and final sentences must be distinct across the five topics. Thirty seconds is a speaking-practice target, not a guaranteed audio duration.

Original-article generators set `interviewSource: originals` in Japanese frontmatter. The bilingual checker validates five complete, distinct questions and non-repeated closing sentences for those dates, before accessing any Chinese body. Both check and sync modes preserve those answers. Unmarked legacy dates retain the existing shared-text policy until their own source review. This is a deliberate per-date source-policy distinction, not an assertion that the two language modes have identical answers. Chinese files stay read-only.

For August 12, the source-specific anchors and review decision are recorded in `2026-08-12.json`. Source anchoring, language naturalness and spoken delivery require editorial review; the automated checks catch structural gaps and exact repetitions, not semantic generalization.
