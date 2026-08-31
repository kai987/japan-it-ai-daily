import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getSafeExternalUrl } from '../lib/urls';

const cleanSearchSegment = (value: string) => value
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/^>\s?/gm, '')
  .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, '')
  .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/https?:\/\/\S+/g, '')
  .replace(/[*_`~]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const reportSegments = (value: unknown) => String(value ?? '')
  .split(/\n{2,}/)
  .map(cleanSearchSegment)
  .filter((segment) => segment.length >= 2);

export const GET: APIRoute = async () => {
  const base = import.meta.env.BASE_URL;
  const reports = (await getCollection('daily')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );

  const searchIndex = reports.flatMap((report) => {
    const date = report.data.date.toISOString().slice(0, 10);
    const reportTopics = report.data.topics ?? [];
    const reportHref = `${base}daily/${report.id}/`;

    const reportItem = {
      id: `report-${report.id}`,
      kind: 'report',
      title: report.data.title ?? '',
      source: '日报',
      topic: '全文',
      why: report.data.description ?? '',
      date,
      href: reportHref,
      external: false,
      reportTitle: report.data.title ?? '',
      reportDescription: report.data.description ?? '',
      reportTopics,
      segments: reportSegments((report as { body?: string }).body ?? ''),
    };

    const articleItems = (report.data.top ?? []).map((item, index) => {
      const safeUrl = getSafeExternalUrl(item.url);
      return {
        id: `${report.id}-${index + 1}`,
        kind: 'article',
        title: item.title ?? '',
        source: item.source ?? '',
        topic: item.topic ?? '',
        why: item.why ?? '',
        date,
        href: safeUrl || reportHref,
        external: Boolean(safeUrl),
        reportTitle: report.data.title ?? '',
        reportDescription: report.data.description ?? '',
        reportTopics,
        segments: [],
      };
    });

    return [reportItem, ...articleItems];
  });

  return new Response(JSON.stringify(searchIndex), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
