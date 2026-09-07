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
  const response = page.waitForResponse((response) => response.url().endsWith('/search-index.json'));
  release();
  await response;
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
