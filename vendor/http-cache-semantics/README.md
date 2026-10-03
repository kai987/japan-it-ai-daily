# Local security patch for http-cache-semantics 4.2.0

This is a private, tracked fork of the BSD-2-Clause npm package, not an upstream release. Its original package name and version are retained. Astro 7.2.9 resolves it through the root npm override; no install-time patching or network-fetched fork is used.

The original `index.js` is from npm 4.2.0 (npm-reported gitHead `83810982b8f8996b101ed761548ea7e87a9132ea`, SHA-256 `01b7d66c854b2fe53ac05c98feb6e0d64722ab8898a778e2d2426a8b468d178f`). The original copyright and license are preserved. Only this file contains runtime changes; package metadata marks the private patch and removes unused upstream development scripts/dependencies.

[GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) affects upstream versions through 4.2.0. As checked on 2026-10-03, no patched release exists. [Proposed upstream PR #58](https://github.com/kornelski/http-cache-semantics/pull/58), revision `14a8c2ad51740dc39bf3e8f1a11c845a5003f217`, informed the central reuse restriction, but is unmerged and is not claimed as a verified release.

The patch separates security restrictions from ordinary expiration and applies them to `evaluateRequest`, freshness, TTL, stale-while-revalidate and stale-if-error. Stale error fallback also checks URL/host/method/Vary identity. Restrictions are honored by presence even with empty parameters, and matching 304 updates retain security headers newly added by the origin. Cache-Control directive names are normalized on parsing and legacy deserialization, as required by [RFC 9111 §5.2](https://httpwg.org/specs/rfc9111.html#field.cache-control). Public/immutable cookie opt-ins, private cache behavior, ordinary stale reuse, conditional validators and v1 serialization remain supported.

`npm audit` does not assess local file dependencies against the registry advisory database. A clean audit alone does **not** prove this fork safe. The unchanged audit gate is complemented by `tests/security/http-cache-semantics.test.mjs`, which verifies Astro resolves this tracked implementation and exercises the reported exploit, alternate stale paths, restored entries, legitimate controls, and Astro's real 200/304 remote-image calls. These tests run in the existing required `npm test` gate.

Astro also falls back to stale remote images after revalidation errors in its own build code; this package patch does not change that separate behavior. This site currently does not use Astro remote-image optimization, and the static Pages runtime does not expose this library as a shared authenticated HTTP cache.

Remove the override and this directory when an official compatible release addresses the restrictions and passes these regressions. Review new upstream advisories while this fork is retained; do not relabel a version, suppress an audit finding, or delete the regression tests just to pass a gate.
