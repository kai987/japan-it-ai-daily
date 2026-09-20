import { reportSegments, type SearchItem } from './search';
import { getSafeExternalUrl } from './urls';
import type { SiteLocale } from './locale';

// Report metadata occurs once per report. Full prose is only in monthly shards.
export interface SearchReport {
  id: string;
  date: string;
  title: string;
  description: string;
  topics: string[];
  segments: string[];
  articles: Array<{ title: string; source: string; topic: string; why: string; url: string }>;
}

export interface SearchManifest {
  version: 1;
  locale: SiteLocale;
  root: string;
  recent: SearchReport[];
  shards: string[];
}

export interface SearchShard { version: 1; reports: SearchReport[] }

interface ReportSource {
  id: string;
  body?: string;
  data: {
    date: Date;
    title?: string;
    description?: string;
    topics?: string[];
    top?: Array<{ title?: string; source?: string; topic?: string; why?: string; url?: string }>;
  };
}

export const buildSearchIndex = (sources: ReportSource[], base: string, locale: SiteLocale) => {
  const root = `${base}${locale === 'ja' ? 'ja/' : ''}`;
  const reports: SearchReport[] = [...sources]
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .map(({ id, body, data }) => ({
      id, date: data.date.toISOString().slice(0, 10),
      title: data.title ?? '', description: data.description ?? '', topics: data.topics ?? [],
      segments: reportSegments(body),
      articles: (data.top ?? []).map((item) => ({
        title: item.title ?? '', source: item.source ?? '', topic: item.topic ?? '',
        why: item.why ?? '', url: getSafeExternalUrl(item.url) || '',
      })),
    }));
  const shards = new Map<string, SearchShard>();
  for (const report of reports) {
    const month = report.date.slice(0, 7);
    const shard = shards.get(month) ?? { version: 1, reports: [] };
    shard.reports.push(report);
    shards.set(month, shard);
  }
  let remaining = 6;
  const recent: SearchReport[] = [];
  for (const report of reports) {
    if (!remaining) break;
    const articles = report.articles.slice(0, remaining);
    if (articles.length) recent.push({ ...report, segments: [], articles });
    remaining -= articles.length;
  }
  const manifest: SearchManifest = {
    version: 1, locale, root, recent,
    shards: [...shards.keys()].map((month) => `${root}search/${month}.json`),
  };
  return { manifest, shards };
};

export const expandSearchReports = (
  reports: SearchReport[],
  { root, locale }: Pick<SearchManifest, 'root' | 'locale'>,
): SearchItem[] => reports.flatMap((report) => {
  const prefix = locale === 'ja' ? 'ja-' : '';
  const href = `${root}daily/${report.id}/`;
  const shared = {
    date: report.date, reportTitle: report.title,
    reportDescription: report.description, reportTopics: report.topics,
  };
  return [{
    ...shared, id: `${prefix}report-${report.id}`, kind: 'report' as const,
    title: report.title, source: locale === 'ja' ? '日報' : '日报', topic: '全文',
    why: report.description, href, external: false, segments: report.segments,
  }, ...report.articles.map((article, index) => ({
    ...shared, id: `${prefix}${report.id}-${index + 1}`, kind: 'article' as const,
    title: article.title, source: article.source, topic: article.topic, why: article.why,
    href: article.url || href, external: Boolean(article.url), segments: [],
  }))];
});
