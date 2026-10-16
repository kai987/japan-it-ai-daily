import { test, expect } from '@playwright/test';

for (const locale of ['ja', 'zh']) {
  const path = `/japan-it-ai-daily/${locale === 'ja' ? 'ja/' : ''}archive/`;

  test(`${locale}: archive pages show only the selected dates and retain keyboard focus`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((language) => localStorage.setItem('site-language', language), locale);
    await page.goto(path);
    const rows = page.locator('[data-archive-row]:visible');
    await expect(rows).toHaveCount(10);
    const total = await page.locator('[data-archive-row]').count();
    const firstDate = await rows.first().getAttribute('href');
    const second = page.locator('.pagination-page').filter({ hasText: /^2$/ });
    await second.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(rows).toHaveCount(10);
    await expect(rows.first()).not.toHaveAttribute('href', firstDate!);
    await expect(page.locator('.pagination-page[aria-current="page"]')).toBeFocused();
    await page.reload();
    await expect(rows).toHaveCount(10);
    await expect(page.locator('.archive-pagination-status')).toHaveText(`11–20 / ${total}`);
    await page.locator('.pagination-page').last().click();
    await expect(rows).toHaveCount(total % 10 || 10);
    await page.goBack();
    await expect(rows).toHaveCount(10);
    await expect(page.locator('.archive-pagination-status')).toHaveText(`11–20 / ${total}`);
    await page.getByRole('combobox').selectOption(locale === 'ja' ? 'zh' : 'ja');
    await expect(page.locator('.archive-pagination-status')).toHaveText(`11–20 / ${total}`);
    await expect(rows).toHaveCount(10);
    expect(errors).toEqual([]);
  });

  test(`${locale}: mobile archive does not overflow`, async ({ page }) => {
    await page.addInitScript((language) => localStorage.setItem('site-language', language), locale);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path + '?page=2');
    await expect(page.locator('[data-archive-row]:visible')).toHaveCount(10);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  for (const flow of [
    { route: 'japanese/', rows: '.lesson-row', pages: '.lesson-pagination-page', status: '.lesson-pagination-status', filter: '[data-level-filter="N1"]', parameter: 'level', value: 'N1', hash: '#lessons' },
    { route: 'interview/', rows: '.interview-day', pages: '.pagination-page', status: '.pagination-status', filter: '[data-filter="Frontend"]', parameter: 'filter', value: 'Frontend', hash: '#interview-list-start' },
  ]) {
    test(`${locale}: ${flow.route} retains numbered-button focus, URL and filter history`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript((language) => {
        if (!localStorage.getItem('site-language')) localStorage.setItem('site-language', language);
      }, locale);
      const root = `/japan-it-ai-daily/${locale === 'ja' ? 'ja/' : ''}`;
      const originalUrl = `${root}${flow.route}?source=bookmark&page=2${flow.hash}`;
      await page.goto(originalUrl);
      const rows = page.locator(`${flow.rows}:visible`);
      const currentPage = page.locator(`${flow.pages}[aria-current="page"]`);
      const total = await page.locator(flow.rows).count();
      const pageTwoContent = await rows.first().textContent();
      await expect(rows).toHaveCount(10);
      await expect(currentPage).toHaveText('2');

      await page.locator(flow.pages).filter({ hasText: /^3$/ }).focus();
      await page.keyboard.press('Enter');
      await expect(currentPage).toHaveText('3');
      await expect(currentPage).toBeFocused();
      await expect(rows.first()).not.toHaveText(pageTwoContent!);
      expect(new URL(page.url()).searchParams.get('page')).toBe('3');
      expect(new URL(page.url()).searchParams.get('source')).toBe('bookmark');
      expect(new URL(page.url()).hash).toBe(flow.hash);
      await page.reload();
      await expect(page.locator(flow.status)).toHaveText(`21–${Math.min(30, total)} / ${total}`);
      await page.goBack();
      await expect(currentPage).toHaveText('2');
      await expect(rows.first()).toHaveText(pageTwoContent!);
      await page.goForward();
      await expect(currentPage).toHaveText('3');

      await page.locator(flow.filter).click();
      await expect(page.locator(flow.filter)).toHaveAttribute('aria-pressed', 'true');
      expect(new URL(page.url()).searchParams.get(flow.parameter)).toBe(flow.value);
      expect(new URL(page.url()).searchParams.has('page')).toBe(false);
      const filteredFirst = await rows.first().textContent();
      await page.reload();
      await expect(page.locator(flow.filter)).toHaveAttribute('aria-pressed', 'true');
      await expect(rows.first()).toHaveText(filteredFirst!);
      await page.goBack();
      await expect(currentPage).toHaveText('3');
      await expect(page.locator(flow.filter)).toHaveAttribute('aria-pressed', 'false');
      await page.goForward();
      await expect(page.locator(flow.filter)).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('combobox').selectOption(locale === 'ja' ? 'zh' : 'ja');
      await expect(page.locator(flow.filter)).toHaveAttribute('aria-pressed', 'true');
      expect(new URL(page.url()).searchParams.get('source')).toBe('bookmark');
      expect(new URL(page.url()).hash).toBe(flow.hash);
      expect(errors).toEqual([]);
    });

    test(`${locale}: ${flow.route} clamps invalid deep-link pages before showing rows`, async ({ page }) => {
      await page.addInitScript((language) => localStorage.setItem('site-language', language), locale);
      const root = `/japan-it-ai-daily/${locale === 'ja' ? 'ja/' : ''}`;
      await page.goto(`${root}${flow.route}?page=999${flow.hash}`);
      const total = await page.locator(flow.rows).count();
      const lastPage = Math.ceil(total / 10);
      await expect(page.locator(`${flow.pages}[aria-current="page"]`)).toHaveText(String(lastPage));
      await expect(page.locator(`${flow.rows}:visible`)).toHaveCount(total % 10 || 10);
      expect(new URL(page.url()).searchParams.get('page')).toBe(String(lastPage));
    });
  }

  test(`${locale}: enterprise interview filter survives switching locale`, async ({ page }) => {
    await page.addInitScript((language) => {
      if (!localStorage.getItem('site-language')) localStorage.setItem('site-language', language);
    }, locale);
    const root = `/japan-it-ai-daily/${locale === 'ja' ? 'ja/' : ''}`;
    await page.goto(`${root}interview/?filter=enterprise-ai`);
    const filter = page.locator('[data-filter-key="enterprise-ai"]');
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('combobox').selectOption(locale === 'ja' ? 'zh' : 'ja');
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    expect(new URL(page.url()).searchParams.get('filter')).toBe('enterprise-ai');
  });
}

test('closing search invalidates an in-flight response', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/search-index.json', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/japan-it-ai-daily/ja/archive/');
  const input = page.locator('.site-search-input');
  await input.focus();
  await expect(page.locator('.site-search-popover')).toBeVisible();
  // The pending keyboard handler must also respect dismissal.
  await input.press('ArrowDown');
  await input.press('Escape');
  await expect(page.locator('.site-search-popover')).toBeHidden();
  release();
  // Dismissal now aborts the request, so a response is not guaranteed to arrive.
  await page.waitForTimeout(250);
  await expect(page.locator('.site-search-popover')).toBeHidden();
  await input.fill('Sandbox');
  await expect(page.locator('.site-search-result').first()).toBeVisible();
  await input.press('ArrowDown');
  await input.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant', 'site-search-option-1');
});

test('search retry and a queued input cannot reopen a dismissed popup', async ({ page }) => {
  await page.route('**/search-index.json', (route) => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/japan-it-ai-daily/ja/archive/');
  const input = page.locator('.site-search-input');
  await input.focus();
  await expect(page.locator('.site-search-status')).toContainText('失敗');
  await input.press('Escape');
  await page.unroute('**/search-index.json');
  await input.fill('Claude');
  await input.press('Escape');
  await page.waitForTimeout(200);
  await expect(page.locator('.site-search-popover')).toBeHidden();
  await input.focus();
  await expect(page.locator('.site-search-result').first()).toBeVisible();
});
