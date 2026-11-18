# Local security patch for picomatch 4.0.7

[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) affects both versions previously in the lockfile. As of 2026-11-18, upstream has no released fix. This private fork retains the upstream name, version, and MIT license. The original npm integrity and source commit are recorded in package.json.

The parser accepts unbounded extglob repetition for fixed-width literal branches and keeps upstream's existing flattening for branches it can reduce to one character class. It treats other repeated groups as literal text even when the caller disables the optional recursion heuristic. Ordinary globstars, braces, and non-repeated extglobs still work. The site's configured globs require no repeated wildcard extglobs.

The root npm override makes Astro, Vite, Vitest, and Chokidar's anymatch resolve this same implementation. Anymatch's file-matching API is covered by a regression test. The other published advisory entries are still evaluated by the existing npm audit gate. npm audit does not cover local file dependencies, so the parser and actual package resolution are checked separately by npm test.

Remove the override and fork once an audited compatible upstream fix passes the publication and browser checks. If the released fix does not support anymatch's older dependency range, keep its resolution explicitly verified before removing the override.
