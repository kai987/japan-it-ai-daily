import { expandSearchReports, type SearchManifest, type SearchShard } from './search-index';
import type { SearchItem } from './search';

export const createSearchLoader = (indexUrl: string, fetcher: typeof fetch = fetch) => {
  let manifest: SearchManifest | undefined;
  let allItems: SearchItem[] | undefined;
  const shards = new Map<string, SearchItem[]>();

  const readJson = async (url: string, signal: AbortSignal) => {
    const response = await fetcher(url, {
      cache: 'no-cache', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    });
    if (!response.ok) throw new Error(`Search index ${url}: HTTP ${response.status}`);
    const data: unknown = await response.json();
    signal.throwIfAborted();
    return data;
  };

  const loadManifest = async (signal: AbortSignal) => {
    signal.throwIfAborted();
    if (!manifest) {
      const data = await readJson(indexUrl, signal) as SearchManifest;
      if (data?.version !== 1 || !Array.isArray(data.recent) || !Array.isArray(data.shards)
        || !data.shards.every((url) => typeof url === 'string') || typeof data.root !== 'string'
        || !['zh', 'ja'].includes(data.locale)) throw new Error('Unsupported search index');
      manifest = data;
    }
    return manifest;
  };

  return {
    async recent(signal: AbortSignal): Promise<SearchItem[]> {
      const index = await loadManifest(signal);
      return expandSearchReports(index.recent, index);
    },
    async all(signal: AbortSignal): Promise<SearchItem[]> {
      signal.throwIfAborted();
      if (allItems) return allItems;
      const index = await loadManifest(signal);
      // A result is complete only after every month succeeds. Successful shards
      // survive a failed/aborted attempt, so retry does not download them again.
      // Sequential downloads bound parsing/memory pressure as history grows.
      for (const url of index.shards) {
        signal.throwIfAborted();
        if (shards.has(url)) continue;
        const data = await readJson(url, signal) as SearchShard;
        if (data?.version !== 1 || !Array.isArray(data.reports)) throw new Error(`Invalid search shard: ${url}`);
        shards.set(url, expandSearchReports(data.reports, index));
      }
      signal.throwIfAborted();
      allItems = index.shards.flatMap((url) => shards.get(url)!);
      return allItems;
    },
  };
};
