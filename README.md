# Japan IT / AI Daily

A bilingual static site for Japanese IT/AI news, engineering interview preparation, and technical Japanese study.

[Read the site](https://kai987.github.io/japan-it-ai-daily/) · [Content quality rules](docs/DAILY_CONTENT_QUALITY_RULES.md) · [Evidence workflow](docs/evidence/README.md)

## Stack

- Astro **7.2.9**, TypeScript, Markdown content collections
- Node.js **24**, npm lockfile-based installs
- GitHub Pages and GitHub Actions
- AivisSpeech-generated MP3; Cloudflare R2 serves production audio
- Vitest, Playwright Chromium, ffprobe, content/evidence/audio validators

## Local development

```sh
npm ci
npm run dev
```

The site base path is `/japan-it-ai-daily/`. The default display language is Japanese; the language selector preserves the corresponding route. Chinese and Japanese article prose are separate content, not runtime translations.

For a production preview and browser regression tests:

```sh
npm run build
npx playwright install chromium
npm run test:browser
```

`npm run preview` also serves `dist/`. The browser-test server is managed by Playwright and stopped afterward. `dist/`, `.astro/` and test artifacts are ignored by Git.

## Content model

Each date has four files:

| Directory | Purpose |
| --- | --- |
| `src/content/daily/` | Chinese report: A detailed articles, B knowledge, C Japanese study |
| `src/content/daily-ja/` | Japanese report, independently written from the originals |
| `src/content/japanese/` | Study identities/examples with Chinese explanations |
| `src/content/japanese-ja/` | Corresponding study data with Japanese explanations |
| `src/content/evidence/` | Reviewed provenance records for new reports from 2026-09-08 |
| `src/data/interviews/` | Canonical Japanese Q&A and localized review points for 9/18 and all dates from 9/19 |

Top article URL, publisher, topic and order must correspond between languages; display titles and explanations may be localized. The five Japanese interview questions/answers are shared verbatim. For 9/18 and all dates from 9/19, `src/data/interviews/YYYY-MM-DD.json` is canonical; earlier dates retain their existing Markdown adapters. `docs/structured-interview-policy.json` automatically requires canonical data for every new report, including when its JSON is missing. Study terms, readings, levels, grammar identities and must-remember selections correspond across modes.

Author the canonical Q&A from original articles, then generate the two Markdown sections without retyping them:

```sh
npm run interview:render -- --date 2026-09-20 --locale ja --section interview
npm run interview:render -- --date 2026-09-20 --locale zh --section review
npm run interview:check
```

The renderer prints fragments to stdout; it does not overwrite either language's documents or unrelated sections. Keep the report's existing section 4 between interview and review. The JSON also holds the review questions' article references and both languages' review points. `interview:check` verifies report mirrors and article order; the interview page and audio generator read canonical JSON directly. This migration preserves existing prose and recordings.

Original articles are the source of facts. A source evidence draft stores article metadata, then reviewers add short original quotes, locations, conditions and links to the actual article/QA excerpts. Never generate Japanese prose by translating the Chinese report. See the [lightweight pilot](docs/evidence/README.md) and [completed history repair records](docs/japanese-history-repair/README.md).

## Shared pages

`src/pages/` and `src/pages/ja/` are thin route adapters. `src/components/pages/` owns shared home, archive, interview, learning list/detail, knowledge, topic list/detail and report rendering. `src/lib/pageCopy.ts` contains interface labels only; `src/lib/learningView.ts` normalizes field names without translating or falling back to the other language's prose.

Legacy interview Markdown extraction lives in `src/lib/interview.ts`; structured records bypass those presentation-dependent parsers. Both modes use the same filters and pagination, while keeping localized labels and existing links. `LessonAudio.astro` handles study playback and `InterviewStaticAudio.astro` handles report recordings; both wait for manifests and invalidate older playback callbacks when stopped or switched. The Chinese report's legacy supplement/title enhancements remain isolated in `LegacyReportEnhancements.astro` so older report behavior is preserved.

Search loads a small `search-index.json` manifest with the latest six article suggestions on focus. A nonempty query loads every monthly `search/YYYY-MM.json` shard for its language, with cooperative processing so input/cancellation remain responsive. It retains full-history ranking, snippets and deep links; a failed month is reported as a retryable error, never a complete partial result. Successfully loaded shards are reused within the page. With the current 40 dates, the entry manifests are 3,879 bytes (zh) and 3,949 bytes (ja), versus roughly 1.5 MB for the previous full index. Full-text queries still load all historical prose.

## Validation

```sh
npm run check
npm run content:integrity:check
npm run evidence:check
npm run evidence:pilot
npm run bilingual:check-interview
npm run quality:check
npm test
npm run build
npm run test:browser
npm run security:check
```

Install ffmpeg/ffprobe only when generating or validating AivisSpeech recordings (`brew install ffmpeg` on macOS). Content integrity checks four-file date coverage, Top 5 identity/order, study counts, unique entries and must-remember membership. Content quality includes article detail, evidence boundaries, technical anchors, repetition and estimated answer duration.

Audio is an optional enhancement to the published text site. Missing audio for a newly published report does **not** block GitHub Pages. When no matching AivisSpeech manifest/MP3 is available, the existing browser Japanese speech fallback remains available. Once audio is generated and committed, the dedicated audio workflow validates the exact text-to-manifest mapping, measures interview duration with ffprobe, uploads the recordings to R2 and verifies the public bytes.

Historical content checks cover **2026-08-12 onward**. The unchanged 9/7 reference has narrowly documented, file-hash-pinned exceptions in [daily-quality-policy.json](docs/daily-quality-policy.json). The new-source evidence policy starts on 9/8.

These checks do not replace original-source review or judgment of natural spoken Japanese.

## Audio generation

MP3s and manifests are versioned under `public/audio/japanese/YYYY-MM-DD/`. R2 is the production delivery copy; manifests are also served with the site when present. Existing local MP3s allow development without R2. Production playback uses an immutable `name--<file-sha256>.mp3` object path, so a new manifest cannot accidentally cache older bytes while R2 is still publishing. Legacy object names remain available for existing pages. Hash-named delivery copies are derived during publication and are not duplicated in Git; local development uses the original files with a version query.

To regenerate audio, start AivisSpeech (default `http://127.0.0.1:10101`) and install ffmpeg:

```sh
npm run audio:generate:latest
# Or a specific date:
node scripts/generate-japanese-audio.mjs --date YYYY-MM-DD
node scripts/generate-interview-audio.mjs --date YYYY-MM-DD
node scripts/validate-interview-audio-duration.mjs --date YYYY-MM-DD --write
```

Before committing audio, run:

```sh
npm run audio:integrity:check
npm run audio:versions:check
npm run audio:duration:check
```

Default voice style ID is `497929760`; interview speed is `1.00`. Generation reuses audio when its text/settings match. Do not edit a manifest to make stale audio appear current. Standard answers target 26–34 seconds, with a hard acceptable range of 22–40 seconds.

Generators write actual file SHA-256 metadata (`wordSha256`, `exampleSha256`, `audioSha256`) separately from synthesis-task hashes, including source recordings reused by later review cards. `npm run audio:versions:write` refreshes only these byte versions for existing files; `audio:versions:check` detects stale versions without writing. Updating byte versions does not validate or change the recording's spoken text. Neither command regenerates MP3s.

Integrity and duration checks report dates with no manifests or recordings as not generated yet. A partial generation (one manifest missing, or MP3s without manifests) fails, as do broken files, stale text and missing cross-date review sources. Local integrity still covers every generated date.

## Deployment

GitHub Pages uses **GitHub Actions** as its source. Text/content publication and audio publication are intentionally independent.

A push to `main` publishes the website after the content gates pass:

```text
Content push
    ↓
dependency audit + type/content/evidence/Q&A/quality checks
    ↓
unit tests + Astro build + browser regressions + CSP
    ↓
GitHub Pages deployment
```

The website can therefore publish a new daily report even when that day's AivisSpeech files have not been generated yet.

A push that changes `public/audio/**` separately triggers the R2 workflow:

```text
Audio push
    ↓
text/manifest integrity + ffprobe duration checks
    ↓
upload changed recordings to Cloudflare R2
    ↓
verify changed recordings and their cross-date references by SHA-256
```

The audio workflow also supports manual execution. Missing R2 credentials or an audio integrity/public-byte mismatch fail the audio workflow, but do not roll back or block an otherwise valid text-only Pages release.

Daily audio pushes verify the changed dates/files and referenced review recordings. Manual runs, weekly audits and verifier/policy changes run full inventory checks. Transient network failures, 429 and 5xx responses receive bounded retries; exhausted network/authentication failures do not trigger bulk reuploads. Only confirmed missing or byte-mismatched objects are repaired, then verified again. The existing orphan cleanup allowlist remains narrow; other remote-only objects, including older content-hash versions, are reported for review.

Configure repository secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`; the bucket is `japan-it-ai-daily-audio`. `PUBLIC_AUDIO_BASE_URL` is an optional repository variable overriding the configured R2 public endpoint. It must use HTTPS. Production Pages artifacts omit committed MP3 binaries while retaining any available manifests. No audio credentials are included in the client.

Pull requests run the content/security/build workflow without requiring same-day audio. Source-generation scripts under `scripts/*source-direct*.py` are optional authoring tools requiring Python, requests, BeautifulSoup and PyYAML; their output still needs the current checks and evidence review before publication.
