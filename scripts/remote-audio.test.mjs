import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { inspectRemoteAssets, reconcileRemoteAssets } from './remote-audio.mjs';
import { immutableAudioAssets } from './audio-publication.mjs';

const bytes = Buffer.from('correct recording');
const expected = { size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
const key = 'japanese/2026-09-20/example-01.mp3';
const assets = new Map([[key, expected]]);
const options = { attempts: 3, delayMs: 0 };

test('transient response and transport failures retry without a repair', async () => {
  const fetcher = vi.fn()
    .mockRejectedValueOnce(new TypeError('socket closed'))
    .mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(new Response(bytes));
  const repair = vi.fn();
  expect(await reconcileRemoteAssets(assets, 'https://audio.example/', repair, fetcher, options)).toEqual({ verified: 1, repaired: [] });
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(fetcher.mock.calls[0][0].searchParams.get('v')).toBe(expected.sha256);
  expect(repair).not.toHaveBeenCalled();
});

test.each([401, 403, 429, 503])('HTTP %i never permits uploads', async (status) => {
  const repair = vi.fn();
  const fetcher = vi.fn(async () => new Response('', { status }));
  await expect(reconcileRemoteAssets(assets, 'https://audio.example/', repair, fetcher, options)).rejects.toThrow(`HTTP ${status}`);
  expect(fetcher).toHaveBeenCalledTimes(status < 408 ? 1 : 3);
  expect(repair).not.toHaveBeenCalled();
});

test('timeout exhaustion remains a failure, never an object repair', async () => {
  const repair = vi.fn();
  const fetcher = vi.fn(async () => { throw new DOMException('timed out', 'TimeoutError'); });
  await expect(reconcileRemoteAssets(assets, 'https://audio.example/', repair, fetcher, options)).rejects.toThrow('timed out');
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(repair).not.toHaveBeenCalled();
});

test('only confirmed missing and mismatched objects are repaired, then reverified', async () => {
  const missing = key.replace('01', '02');
  const stale = key.replace('01', '03');
  const all = new Map([[key, expected], [missing, expected], [stale, expected]]);
  const repaired = new Set();
  const repair = vi.fn(async (path) => { repaired.add(path); });
  const fetcher = vi.fn(async (url) => {
    const path = url.pathname.slice(1);
    if (repaired.has(path) || path === key) return new Response(bytes);
    return path === missing ? new Response('', { status: 404 }) : new Response('stale recording');
  });
  const result = await reconcileRemoteAssets(all, 'https://audio.example/', repair, fetcher, options);
  expect(result).toEqual({ verified: 3, repaired: [missing, stale] });
  expect(repair.mock.calls.map(([path]) => path)).toEqual([missing, stale]);
  expect(fetcher.mock.calls.filter(([url]) => url.pathname === `/${key}`)).toHaveLength(1);
});

test('one fatal request prevents repairs of other missing objects', async () => {
  const all = new Map([[key, expected], [key.replace('01', '02'), expected]]);
  const repair = vi.fn();
  const fetcher = async (url) => url.pathname.endsWith('01.mp3')
    ? new Response('', { status: 404 }) : new Response('', { status: 503 });
  await expect(reconcileRemoteAssets(all, 'https://audio.example/', repair, fetcher, options)).rejects.toThrow('503');
  expect(repair).not.toHaveBeenCalled();
});

test('a claimed repair cannot pass when the public bytes remain stale', async () => {
  const repair = vi.fn();
  await expect(reconcileRemoteAssets(assets, 'https://audio.example/', repair, async () => new Response('still stale'), options)).rejects.toThrow('SHA-256 mismatch');
  expect(repair).toHaveBeenCalledTimes(1);
});

test('invalid endpoint and unbounded retries fail before network access', async () => {
  const fetcher = vi.fn();
  await expect(inspectRemoteAssets(assets, 'http://audio.example', fetcher, options)).rejects.toThrow('HTTPS');
  await expect(inspectRemoteAssets(assets, 'https://audio.example', fetcher, { attempts: 99 })).rejects.toThrow('bounded');
  expect(fetcher).not.toHaveBeenCalled();
});

test('immutable verification uses the exact playback path and batch repair keeps the original local source', async () => {
  const immutable = immutableAudioAssets(assets);
  const repairBatch = vi.fn();
  let repaired = false;
  repairBatch.mockImplementation(async (selected) => {
    expect([...selected.values()][0].sourcePath).toBe(key);
    expect([...selected.keys()][0]).toContain(`--${expected.sha256}.mp3`);
    repaired = true;
  });
  const fetcher = vi.fn(async (url) => {
    expect(url.search).toBe('');
    expect(url.pathname).toBe(`/${[...immutable.keys()][0]}`);
    return repaired ? new Response(bytes) : new Response('', { status: 404 });
  });
  expect((await reconcileRemoteAssets(immutable, 'https://audio.example/', undefined, fetcher, { ...options, repairBatch })).verified).toBe(1);
  expect(repairBatch).toHaveBeenCalledTimes(1);
});

test('fatal network errors never trigger batch repair, even alongside confirmed missing versions', async () => {
  const immutable = immutableAudioAssets(new Map([[key, expected], [key.replace('01', '02'), expected]]));
  const repairBatch = vi.fn();
  await expect(reconcileRemoteAssets(immutable, 'https://audio.example/', undefined, async url => {
    if (url.pathname.includes('example-01--')) return new Response('', { status: 404 });
    throw new TypeError('network down');
  }, { ...options, repairBatch })).rejects.toThrow('network down');
  expect(repairBatch).not.toHaveBeenCalled();
});
