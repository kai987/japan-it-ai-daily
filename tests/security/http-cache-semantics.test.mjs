import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve('astro/package.json'));
const CachePolicy = astroRequire('http-cache-semantics');
const request = { url: 'https://example.test/account', headers: { host: 'example.test' } };
const staleExtensions = ', stale-while-revalidate=60, stale-if-error=60';
const protectedResponses = [
  ['cookie', 'max-age=0', { 'set-cookie': 'session=alice' }],
  ['no-cache', 'no-cache', {}],
  ['proxy-revalidate', 'proxy-revalidate', {}],
  ['no-store', 'no-store', {}],
  ['private', 'private', {}],
  ['mixed no-cache', 'max-age=60, No-Cache', {}],
  ['mixed proxy-revalidate', 'max-age=60, PROXY-REVALIDATE', {}],
  ['mixed no-store', 'max-age=60, NO-STORE', {}],
  ['mixed private', 'max-age=60, Private', {}],
  ['qualified no-cache', 'max-age=60, no-cache="set-cookie"', {}],
  ['empty no-cache', 'max-age=60, no-cache=""', {}],
  ['empty proxy-revalidate', 'max-age=60, proxy-revalidate=', {}],
  ['empty no-store', 'max-age=60, no-store=""', {}],
  ['empty private', 'max-age=60, private=""', {}],
];

function policy(cc, headers = {}, options = {}) {
  const p = new CachePolicy(request, { status: 200, headers: { 'cache-control': cc, ...headers } }, options);
  p.now = () => p._responseTime + 1000;
  return p;
}

function restore(p) {
  const restored = CachePolicy.fromObject(JSON.parse(JSON.stringify(p.toObject())));
  restored.now = p.now;
  return restored;
}

describe('patched HTTP cache dependency', () => {
  it('Astro resolves the tracked fork, with the original package identity', () => {
    const installed = astroRequire.resolve('http-cache-semantics');
    const tracked = fileURLToPath(new URL('../../vendor/http-cache-semantics/index.js', import.meta.url));
    expect(realpathSync(installed)).toBe(realpathSync(tracked));
    expect(readFileSync(installed)).toEqual(readFileSync(tracked));
    const manifest = astroRequire('http-cache-semantics/package.json');
    expect(manifest.name).toBe('http-cache-semantics');
    expect(manifest.version).toBe('4.2.0');
    expect(manifest['x-local-security-patch'].advisory).toBe('GHSA-ch52-4w7c-c8xp');
  });

  for (const [name, cc, headers] of protectedResponses) {
    for (const restored of [false, true]) {
      it(`${name} cannot be reused through any stale path${restored ? ' after restoration' : ''}`, () => {
        let p = policy(cc + staleExtensions, headers);
        if (restored) p = restore(p);
        for (const directive of ['max-stale=3600', 'max-stale', 'MAX-STALE=3600']) {
          const incoming = { ...request, headers: { ...request.headers, 'cache-control': directive } };
          expect(p.satisfiesWithoutRevalidation(incoming)).toBe(false);
          expect(p.evaluateRequest(incoming).response).toBeUndefined();
          expect(p.evaluateRequest(incoming).revalidation.synchronous).toBe(true);
        }
        expect(p.timeToLive()).toBe(0);
        expect(p.useStaleWhileRevalidate()).toBe(false);
        expect(p.revalidatedPolicy(request, { status: 503, headers: {} }).modified).toBe(true);
      });
    }
  }

  it('normalizes directive maps from pre-patch serialized cache entries', () => {
    const serialized = policy('max-age=60' + staleExtensions).toObject();
    serialized.rescc['No-Cache'] = true;
    const p = CachePolicy.fromObject(serialized);
    expect(p.satisfiesWithoutRevalidation(request)).toBe(false);
    expect(p.timeToLive()).toBe(0);
    delete serialized.rescc['No-Cache'];
    serialized.reqcc['No-Store'] = true;
    expect(CachePolicy.fromObject(serialized).storable()).toBe(false);
  });

  it.each(['max-age=0, must-revalidate', 'max-age=0, must-revalidate=', 's-maxage=0'])('%s forbids all stale extensions', (cc) => {
    const p = policy(cc + staleExtensions);
    expect(p.satisfiesWithoutRevalidation({ ...request, headers: { ...request.headers, 'cache-control': 'max-stale' } })).toBe(false);
    expect(p.timeToLive()).toBe(0);
    expect(p.useStaleWhileRevalidate()).toBe(false);
    expect(p.revalidatedPolicy(request, { status: 503, headers: {} }).modified).toBe(true);
  });

  it('preserves fresh shared s-maxage lifetime without stale extensions', () => {
    const p = policy('s-maxage=60' + staleExtensions);
    expect(p.satisfiesWithoutRevalidation(request)).toBe(true);
    expect(p.timeToLive()).toBe(59000);
  });

  it.each([
    ['public cookie', 'public, max-age=60', { 'set-cookie': 'session=alice' }, {}],
    ['immutable cookie', 'immutable, max-age=60', { 'set-cookie': 'session=alice' }, {}],
    ['private cookie', 'max-age=60', { 'set-cookie': 'session=alice' }, { shared: false }],
    ['private proxy-revalidate', 'proxy-revalidate, max-age=60', {}, { shared: false }],
  ])('preserves explicitly allowed %s freshness', (_name, cc, headers, options) => {
    const p = restore(policy(cc, headers, options));
    expect(p.storable()).toBe(true);
    expect(p.satisfiesWithoutRevalidation(request)).toBe(true);
    expect(p.timeToLive()).toBe(59000);
  });

  it('preserves ordinary expired max-age=0, bounded max-stale and stale extensions', () => {
    const p = policy('public, max-age=0' + staleExtensions);
    expect(p.satisfiesWithoutRevalidation({ ...request, headers: { ...request.headers, 'cache-control': 'max-stale=30' } })).toBe(true);
    expect(p.useStaleWhileRevalidate()).toBe(true);
    expect(p.timeToLive()).toBe(59000);
    expect(p.revalidatedPolicy(request, { status: 503, headers: {} }).modified).toBe(false);
    expect(policy('max-age=0').satisfiesWithoutRevalidation({ ...request, headers: { ...request.headers, 'cache-control': 'max-stale=0' } })).toBe(false);
  });

  it('does not reuse stale-if-error for a different URL, host, method or Vary value', () => {
    const p = policy('public, max-age=0, stale-if-error=60', { vary: 'accept-language' });
    for (const incoming of [
      { ...request, url: 'https://example.test/other' },
      { ...request, headers: { host: 'other.test' } },
      { ...request, method: 'POST' },
      { ...request, headers: { ...request.headers, 'accept-language': 'ja' } },
    ]) expect(p.revalidatedPolicy(incoming, { status: 503, headers: {} }).modified).toBe(true);
    expect(p.revalidatedPolicy({ ...request, method: 'HEAD' }, { status: 503, headers: {} }).modified).toBe(false);
  });

  it('preserves conditional ETag revalidation and a matching 304', () => {
    const p = policy('public, max-age=0', { etag: '"image-v1"' });
    expect(p.revalidationHeaders(request)['if-none-match']).toBe('"image-v1"');
    const result = p.revalidatedPolicy(request, { status: 304, headers: { etag: '"image-v1"', 'cache-control': 'public, max-age=60' } });
    expect(result.modified).toBe(false);
    expect(result.matches).toBe(true);
    expect(result.policy.satisfiesWithoutRevalidation(request)).toBe(true);
  });

  it('preserves the documented explicit ignoreCargoCult opt-in', () => {
    const p = policy('pre-check=0, post-check=0, no-cache, no-store, max-age=60', {}, { ignoreCargoCult: true });
    expect(p.satisfiesWithoutRevalidation(request)).toBe(true);
  });

  it.each([
    { 'cache-control': 'private' },
    { 'cache-control': 'no-cache' },
    { 'set-cookie': 'session=alice' },
  ])('honors security headers first introduced by a matching 304: %j', (restriction) => {
    const p = new CachePolicy(request, { status: 200, headers: { etag: '"v1"', expires: 'Thu, 01 Jan 1970 00:00:00 GMT' } });
    const result = p.revalidatedPolicy(request, { status: 304, headers: { etag: '"v1"', ...restriction } });
    expect(result.matches).toBe(true);
    expect(result.policy.satisfiesWithoutRevalidation({ ...request, headers: { ...request.headers, 'cache-control': 'max-stale' } })).toBe(false);
    expect(result.policy.timeToLive()).toBe(0);
  });

  it('Astro remote-image 200 and 304 callers receive zero expiry for restricted responses', async () => {
    const path = new URL('../../node_modules/astro/dist/assets/build/remote.js', import.meta.url).href;
    const { loadRemoteImage, revalidateRemoteImage } = await import(/* @vite-ignore */ path);
    for (const [, cc, headers] of protectedResponses) {
      const responseHeaders = { 'cache-control': cc + staleExtensions, ...headers };
      const before = Date.now();
      const result = await loadRemoteImage(request.url, async () => new Response('image', { headers: responseHeaders }));
      expect(result.data.toString()).toBe('image');
      expect(result.expires).toBeGreaterThanOrEqual(before);
      expect(result.expires).toBeLessThanOrEqual(Date.now());
      const refreshed = await revalidateRemoteImage(request.url, { etag: '"v1"' }, async () => new Response(null, { status: 304, headers: responseHeaders }));
      expect(refreshed.data).toBeNull();
      expect(refreshed.expires).toBeLessThanOrEqual(Date.now());
    }
    const fresh = await loadRemoteImage(request.url, async () => new Response('image', { headers: { 'cache-control': 'public, max-age=60' } }));
    expect(fresh.expires).toBeGreaterThan(Date.now() + 59000);
  });
});
