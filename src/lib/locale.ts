export type SiteLocale = 'zh' | 'ja';

export const DEFAULT_LOCALE: SiteLocale = 'ja';

export const localeRoot = (base: string, locale: SiteLocale): string =>
  locale === 'ja' ? `${base}ja/` : base;

export const localizedPath = (base: string, locale: SiteLocale, path = ''): string => {
  const clean = path.replace(/^\/+|\/+$/g, '');
  const root = localeRoot(base, locale);
  return clean ? `${root}${clean}/` : root;
};

export const switchLocalePathname = (
  pathname: string,
  base: string,
  locale: SiteLocale,
): string => {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const relative = pathname.startsWith(normalizedBase)
    ? pathname.slice(normalizedBase.length)
    : pathname.replace(/^\/+/, '');
  const withoutJa = relative.replace(/^ja\//, '');
  return locale === 'ja'
    ? `${normalizedBase}ja/${withoutJa}`
    : `${normalizedBase}${withoutJa}`;
};
