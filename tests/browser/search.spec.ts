import { test, expect } from '@playwright/test';

for (const locale of ['zh', 'ja']) {
  const root = `/japan-it-ai-daily/${locale === 'ja' ? 'ja/' : ''}`;

  test(`${locale}: search remains reachable at the menu and tablet breakpoints`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((language) => localStorage.setItem('site-language', language), locale);
    for (const width of [390, 800, 801, 850, 900, 1000]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${root}archive/`);
      const input = page.locator('.site-search-input');
      if (width <= 800) await page.locator('.mobile-menu-toggle').click();
      await expect(input, `${width}px search`).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px header fits`).toBe(true);
      if (width > 800) {
        const brand = await page.locator('.brand').boundingBox();
        const search = await page.locator('.site-search').boundingBox();
        const actions = await page.locator('.nav-actions').boundingBox();
        expect(brand!.x + brand!.width, `${width}px brand/search gap`).toBeLessThanOrEqual(search!.x);
        expect(search!.x + search!.width, `${width}px search/navigation gap`).toBeLessThanOrEqual(actions!.x);
      }
      await input.focus();
      await input.fill('Sandbox');
      const report = page.locator(`.site-search-result[href^="${root}daily/"]`).first();
      await expect(report).toHaveAttribute('href', /search=Sandbox/);
      const optionId = await report.getAttribute('id');
      const optionIndex = Number(optionId!.split('-').at(-1));
      for (let index = 0; index <= optionIndex; index++) await input.press('ArrowDown');
      await expect(input).toHaveAttribute('aria-activedescendant', optionId!);
      const href = await report.getAttribute('href');
      await input.press('Enter');
      await expect(page).toHaveURL(new RegExp(`${root}daily/`));
      expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(href);
    }
    expect(errors).toEqual([]);
  });

  test(`${locale}: recent suggestions are lightweight, and full-text queries search every month`, async ({ page, request }) => {
    await page.addInitScript((language) => localStorage.setItem('site-language', language), locale);
    const manifest = await (await request.get(`${root}search-index.json`)).json();
    const oldestShard = await (await request.get(manifest.shards.at(-1))).json();
    const oldest = oldestShard.reports.at(-1);
    // A body-only phrase proves this does not merely search recent metadata.
    const phrase = oldest.segments.find((segment: string) => segment.length > 40).slice(8, 35);
    const requested: string[] = [];
    page.on('request', (req) => { if (/\/search\/\d{4}-\d{2}\.json$/.test(req.url())) requested.push(req.url()); });
    await page.goto(`${root}archive/`);
    const input = page.locator('.site-search-input');
    await input.focus();
    await expect(page.locator('.site-search-result')).toHaveCount(6);
    expect(requested).toEqual([]);
    await input.fill(phrase);
    const result = page.locator(`.site-search-result[href*="/daily/${oldest.id}/"]`);
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute('href', new RegExp('search='));
    await expect(result.locator('mark')).toContainText(phrase);
    expect(new Set(requested).size).toBe(manifest.shards.length);
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/daily/${oldest.id}/\\?search=`));
  });
}

test('a failed historical shard is retryable and never appears as a complete partial search', async ({ page }) => {
  await page.goto('/japan-it-ai-daily/ja/archive/');
  const manifest = await (await page.request.get('/japan-it-ai-daily/ja/search-index.json')).json();
  const lastShard = `**${manifest.shards.at(-1)}`;
  await page.route(lastShard, (route) => route.fulfill({ status: 503, body: 'unavailable' }));
  const input = page.locator('.site-search-input');
  await input.fill('Sandbox');
  await expect(page.locator('.site-search-status')).toContainText('失敗');
  await expect(page.locator('.site-search-result')).toHaveCount(0);
  await page.unroute(lastShard);
  await input.press('Escape');
  await input.focus();
  await expect(page.locator('.site-search-result').first()).toBeVisible();
});

test('changing a query during a delayed shard load cannot restore stale results', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let delayed = false;
  await page.route('**/search/*.json', async (route) => {
    if (!delayed) {
      delayed = true;
      await gate;
    }
    await route.continue();
  });
  await page.goto('/japan-it-ai-daily/ja/archive/');
  const input = page.locator('.site-search-input');
  await input.fill('Sandbox');
  await expect.poll(() => delayed).toBe(true);
  await input.fill('');
  await expect(page.locator('.site-search-status')).toHaveText('最近の記事');
  release();
  await page.waitForTimeout(200);
  await expect(page.locator('.site-search-status')).toHaveText('最近の記事');
  await expect(page.locator('.site-search-result')).toHaveCount(6);
});
