import { describe, expect, it, vi } from 'vitest';
import { buildSearchIndex, expandSearchReports } from './search-index';
import { createSearchLoader } from './search-loader';
import { searchItems, searchItemsAsync } from './search';

const makeSource = (date: string) => ({
  id: date,
  body: `## Background\n\nOnly the ${date} report contains this historical evidence.\n\nＳａｎｄｂｏｘ の検証条件。`,
  data: {
    date: new Date(date), title: `${date} daily`, description: `Description for ${date}`,
    topics: ['AI', 'Sandbox'],
    top: Array.from({ length: 5 }, (_, i) => ({
      title: `Claude ${i}`, source: 'Original', topic: 'AI', why: `Reason ${i}`,
      url: i === 0 ? 'javascript:alert(1)' : `https://example.com/${date}/${i}`,
    })),
  },
});

const sources = [makeSource('2026-08-12'), makeSource('2026-09-20'), makeSource('2026-09-19')];

describe.each(['zh', 'ja'] as const)('%s search wire format', (locale) => {
  it('keeps all prose in month shards and only the newest six article summaries in the manifest', () => {
    const { manifest, shards } = buildSearchIndex(sources, '/base/', locale);
    expect([...shards.keys()]).toEqual(['2026-09', '2026-08']);
    expect(manifest.shards).toEqual([...shards.keys()].map((month) => `${manifest.root}search/${month}.json`));
    expect(manifest.recent.flatMap((report) => report.segments)).toEqual([]);
    expect(manifest.recent.flatMap((report) => report.articles)).toHaveLength(6);
    const expanded = [...shards.values()].flatMap((shard) => expandSearchReports(shard.reports, manifest));
    const recent = expandSearchReports(manifest.recent, manifest);
    expect(searchItems(recent, '')).toEqual(searchItems(expanded, ''));
    expect(searchItems(expanded, 'historical evidence').filter((hit) => hit.kind === 'report').map((hit) => hit.date))
      .toEqual(['2026-09-20', '2026-09-19', '2026-08-12']);
    const firstArticle = expanded.find((item) => item.kind === 'article')!;
    expect(firstArticle.external).toBe(false);
    expect(firstArticle.href).toBe(`${manifest.root}daily/2026-09-20/`);
    expect(firstArticle.id).toBe(`${locale === 'ja' ? 'ja-' : ''}2026-09-20-1`);
    expect(JSON.stringify([...shards.values()]).length).toBeLessThan(JSON.stringify(expanded).length);
  });
});

describe('complete, interruptible full-text search', () => {
  const { manifest, shards } = buildSearchIndex(sources, '/base/', 'ja');
  const items = [...shards.values()].flatMap((shard) => expandSearchReports(shard.reports, manifest));

  it.each(['', 'Sandbox', 'Cluade', 'historical evidence', '2026-08-12', '検証条件'])
    ('has exactly the same global ranking, snippets and destinations for %s', async (query) => {
      expect(await searchItemsAsync(items, query, { yieldControl: async () => {} })).toEqual(searchItems(items, query));
    });

  it('yields between bounded groups and stops obsolete work before the next group', async () => {
    const controller = new AbortController();
    const yieldControl = vi.fn(async () => { if (yieldControl.mock.calls.length === 2) controller.abort(); });
    await expect(searchItemsAsync(items, 'Sandbox', { signal: controller.signal, yieldControl }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(yieldControl).toHaveBeenCalledTimes(2);
  });
});

describe('search loader', () => {
  const { manifest, shards } = buildSearchIndex(sources, '/base/', 'ja');
  const signal = () => new AbortController().signal;
  const responses = new Map<string, unknown>([
    ['/index.json', manifest],
    ...[...shards].map(([month, shard]): [string, unknown] => [`${manifest.root}search/${month}.json`, shard]),
  ]);

  it('does not download historical text on focus, and retries only a failed shard without showing partial matches', async () => {
    let failAugust = true;
    const fetcher = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('2026-08') && failAugust) return new Response('', { status: 503 });
      return Response.json(responses.get(String(url)));
    });
    const loader = createSearchLoader('/index.json', fetcher);
    expect(searchItems(await loader.recent(signal()), '')).toHaveLength(6);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/index.json']);
    await expect(loader.all(signal())).rejects.toThrow('HTTP 503');
    failAugust = false;
    const all = await loader.all(signal());
    expect(all).toHaveLength(18);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/index.json', manifest.shards[0], manifest.shards[1], manifest.shards[1],
    ]);
    await loader.all(signal());
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('does not cache a response after dismissal, even if a fetch implementation ignores abort', async () => {
    const controller = new AbortController();
    let cancel = true;
    const fetcher = vi.fn(async () => {
      if (cancel) controller.abort();
      return Response.json(manifest);
    });
    const loader = createSearchLoader('/index.json', fetcher);
    await expect(loader.recent(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    cancel = false;
    expect(await loader.recent(signal())).toHaveLength(8);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects an unknown index protocol instead of silently showing an empty list', async () => {
    const loader = createSearchLoader('/index.json', async () => Response.json([]));
    await expect(loader.all(signal())).rejects.toThrow('Unsupported search index');
  });
});
