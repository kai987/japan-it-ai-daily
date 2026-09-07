# Lightweight original-source evidence pilot

Required for new reports dated **2026-09-08 or later**. Historic reports remain unchanged. The manifest checks traceability of declared claims, not whether every sentence is true or whether a model meets a particular quality level.

## Workflow

1. Select five originals and preserve their identity/order. Fetch or read the original pages; record any public-only access or unavailable sections. Never substitute a Chinese summary for an original source.
2. Create a draft from Top 5 frontmatter, or from the metadata-only `source-context.json` produced by `prepare-source-direct-context.py`:

```sh
npm run evidence:init -- --date 2026-09-08
# Before the report exists, use a selected-article context instead:
npm run evidence:init -- --date 2026-09-08 --context /tmp/new-report/source-context.json
```

The command creates `src/content/evidence/YYYY-MM-DD.json` with exclusive creation: an existing record is never overwritten. It copies only article metadata and does not mark sources or claims as reviewed.

3. Write Chinese and Japanese prose independently from the originals. The Japanese interview questions and answers remain shared verbatim. The evidence record is shared provenance, not a Chinese-to-Japanese translation pipeline.
4. Complete `claims` with a concise statement, original short quote, section/paragraph locator, and conditions. Record central conclusions, numerical comparisons with their conditions, and interview-specific anchors. `usedIn.zh`, `usedIn.ja`, and `usedIn.interview` identify exact excerpts in the corresponding Top article/QA; localized excerpts may differ.
5. Distinguish `source-fact`, `author-interpretation`, and `teaching-example`. Interpretations/examples must refer to a registered source fact via `basedOn`; a source fact needs its own quote. Mark access as `full` or `public-portion` and explain the observed scope; inaccessible content must not be reconstructed.
6. Save capture timestamps and SHA-256 for original snapshots outside the repository. Review the originals and claims before setting `status: reviewed`, `reviewedBy`, and `reviewedAt`. These fields record a review; they are not evidence that the review was correct.
7. Before publication, verify quotes against the captured original files (`01.txt` … `05.txt`):

```sh
npm run evidence:check -- --date 2026-09-08 --source-dir /tmp/new-report/originals
npm run content:integrity:check
npm run quality:check
```

CI checks metadata/order, declared quote/locator/conditions, source capture metadata, review status, inference references, and mappings to Chinese/Japanese article sections and shared interview text. New reports without a reviewed record fail. Offline CI does **not** fetch paywalled sites, verify that a quote came from a live page, or guarantee semantic correctness. `--source-dir` additionally verifies snapshot hashes and quote occurrence; a reviewer still judges whether the evidence supports the claim. No minimum prose length or model-quality guarantee is implied.

## Completed pilot

`pilot-2026-09-07.json` exercises the workflow with one declared core claim per reference article. The five public originals were retrieved on 2026-09-08 JST and the quotes checked against local snapshots. Source URLs, capture hashes, access scope and claim mappings are in the record. Full source snapshots remain outside Git to avoid republishing entire articles.

```sh
npm run evidence:pilot
# Repeat capture-byte verification when those original snapshots are available:
npm run evidence:pilot -- --source-dir /tmp/daily-evidence-pilot/originals
```

This pilot does not modify or re-approve all 9/7 prose. In particular, it does not validate every metric in its model/runtime articles. The production gate starts at 9/8; before the first new report, it explicitly reports zero eligible dates instead of claiming that a new report was reviewed.
