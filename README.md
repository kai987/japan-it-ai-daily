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

Top article URL, publisher, topic and order must correspond between languages; display titles and explanations may be localized. The five Japanese interview questions/answers are shared verbatim, with `daily` as their canonical copy. Study terms, readings, levels, grammar identities and must-remember selections correspond across modes.

Original articles are the source of facts. A source evidence draft stores article metadata, then reviewers add short original quotes, locations, conditions and links to the actual article/QA excerpts. Never generate Japanese prose by translating the Chinese report. See the [lightweight pilot](docs/evidence/README.md) and [completed history repair records](docs/japanese-history-repair/README.md).

## Shared pages

`src/pages/` and `src/pages/ja/` are thin route adapters. `src/components/pages/` owns shared home, archive, interview, learning list/detail, knowledge, topic list/detail and report rendering. `src/lib/pageCopy.ts` contains interface labels only; `src/lib/learningView.ts` normalizes field names without translating or falling back to the other language's prose.

Interview Markdown extraction lives in `src/lib/interview.ts`. Both modes use the same filters and pagination, while keeping localized labels and existing links. `LessonAudio.astro` handles study playback, root-relative manifests, R2 URLs, stop/switch behavior and browser speech fallback. `InterviewStaticAudio.astro` handles report recordings. The Chinese report's legacy supplement/title enhancements remain isolated in `LegacyReportEnhancements.astro` so older report behavior is preserved.

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

MP3s and manifests are currently versioned under `public/audio/japanese/YYYY-MM-DD/`. R2 is the production delivery copy; manifests are also served with the site when present. Existing local MP3s allow development without R2.

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
npm run audio:duration:check
```

Default voice style ID is `497929760`; interview speed is `1.00`. Generation reuses audio when its text/settings match. Do not edit a manifest to make stale audio appear current. Standard answers target 26–34 seconds, with a hard acceptable range of 22–40 seconds.

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
verify deployed MP3 SHA-256 hashes
```

The audio workflow also supports manual execution. Missing R2 credentials or an audio integrity/public-byte mismatch fail the audio workflow, but do not roll back or block an otherwise valid text-only Pages release.

Configure repository secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`; the bucket is `japan-it-ai-daily-audio`. `PUBLIC_AUDIO_BASE_URL` is an optional repository variable overriding the configured R2 public endpoint. It must use HTTPS. Production Pages artifacts omit committed MP3 binaries while retaining any available manifests. No audio credentials are included in the client.

Pull requests run the content/security/build workflow without requiring same-day audio. Source-generation scripts under `scripts/*source-direct*.py` are optional authoring tools requiring Python, requests, BeautifulSoup and PyYAML; their output still needs the current checks and evidence review before publication.
