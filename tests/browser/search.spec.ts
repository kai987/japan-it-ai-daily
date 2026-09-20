import { test, expect } from '@playwright/test';

for (const locale of ['zh', 'ja']) {
  const root = `/japan-it-ai-daily/${locale === 'ja' ? 'ja/' : ''}`;

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
