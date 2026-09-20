import { getCollection } from 'astro:content';
import type { SiteLocale } from './locale';
import { buildSearchIndex } from './search-index';

export const getSearchIndex = async (locale: SiteLocale) => buildSearchIndex(
  await getCollection(locale === 'ja' ? 'dailyJa' : 'daily'),
  import.meta.env.BASE_URL,
  locale,
);

export const searchJsonResponse = (value: unknown) => new Response(JSON.stringify(value), {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
