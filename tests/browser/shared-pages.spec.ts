import { test, expect } from '@playwright/test';

for (const locale of ['zh', 'ja']) {
  const root = `/japan-it-ai-daily/${locale === 'ja' ? 'ja/' : ''}`;
  test.describe(`${locale} shared routes`, () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((language) => {
      if (!localStorage.getItem('site-language')) localStorage.setItem('site-language', language);
    }, locale);
  });

  test(`${locale}: interview answers, filter, pagination and daily route`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${root}interview/`);
    const days = page.locator('.interview-day');
    const count = await days.count();
    await expect(page.locator('.interview-answer-card')).toHaveCount(count * 5);
    await expect(page.locator('.review-row')).toHaveCount(count * 3);
    await expect(page.locator('.interview-day:visible')).toHaveCount(10);
    await page.locator('.pagination-next').click();
    await expect(page.locator('.pagination-status')).toHaveText(`11–20 / ${count}`);
    await page.locator('[data-filter="Frontend"]').click();
    await expect(page.locator('[data-filter="Frontend"]')).toHaveAttribute('aria-pressed', 'true');
    const matching = await page.locator('.interview-day[data-categories*="Frontend"]').count();
    await expect(page.locator('.interview-day:visible')).toHaveCount(Math.min(10, matching));
    expect(await page.locator('.interview-day:visible').evaluateAll((els) => els.every((el) => (el.getAttribute('data-categories') || '').split('|').includes('Frontend')))).toBe(true);
    await page.locator('[data-filter="all"]').click();
    const link = page.locator('.interview-day:visible .daily-link').first();
    const href = await link.getAttribute('href');
    expect(href).toMatch(new RegExp(`^${root}daily/`));
    await link.click();
    await expect(page.locator('article.prose')).toBeVisible();
    await expect(page.locator('.report-speech-button')).toHaveCount(13);
    expect(errors).toEqual([]);
  });

  test(`${locale}: learning filters retain URL state, pagination and locale route`, async ({ page }) => {
    await page.goto(`${root}japanese/?level=IT%2FAI&page=2#lessons`);
    await expect(page.locator('.lesson-row:visible')).toHaveCount(10);
    await expect(page.locator('[data-level-filter="IT/AI"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.lesson-pagination-page[aria-current="page"]')).toHaveText('2');
    await page.reload();
    await expect(page.locator('.lesson-pagination-page[aria-current="page"]')).toHaveText('2');
    await page.locator('[data-level-filter="N1"]').click();
    await expect(page).toHaveURL(/\?level=N1#lessons$/);
    const total = await page.locator('.lesson-row[data-levels*="N1"]').count();
    await expect(page.locator('.lesson-row:visible')).toHaveCount(Math.min(total, 10));
    await page.getByRole('combobox').selectOption(locale === 'ja' ? 'zh' : 'ja');
    await expect(page.locator('[data-level-filter="N1"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.lesson-row:visible')).toHaveCount(Math.min(total, 10));
    const otherRoot = `/japan-it-ai-daily/${locale === 'ja' ? '' : 'ja/'}`;
    await expect(page.locator('.lesson-row:visible').first()).toHaveAttribute('href', new RegExp(`^${otherRoot}japanese/`));
  });

  test(`${locale}: lesson audio uses root manifest, plays, switches and stops`, async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    await page.addInitScript(() => {
      const original = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        (window as any).__lastPlayed = this;
        return original.call(this);
      };
    });
    const manifest = page.waitForResponse((response) => response.url().endsWith('/audio/japanese/2026-09-07/manifest.json'));
    await page.goto(`${root}japanese/2026-09-07/`);
    expect((await manifest).ok()).toBe(true);
    const first = page.locator('[data-speech-kind="example"]').first();
    const second = page.locator('[data-speech-kind="grammar-example"]').first();
    await expect(first).toHaveAttribute('data-audio-provider', 'aivis');
    await first.click();
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => (window as any).__lastPlayed?.currentTime || 0)).toBeGreaterThan(0);
    await second.click();
    await expect(first).toHaveAttribute('aria-pressed', 'false');
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await second.click();
    await expect(second).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => (window as any).__lastPlayed.paused)).toBe(true);
    expect(failures).toEqual([]);
  });

  test(`${locale}: failed recording falls back to Japanese speech`, async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', { value: {
        getVoices: () => [], cancel: () => {},
        speak: (utterance: SpeechSynthesisUtterance) => { (window as any).__fallback = { text: utterance.text, lang: utterance.lang }; },
      } });
    });
    await page.route('**/*.mp3', (route) => route.abort());
    await page.goto(`${root}japanese/2026-09-07/`);
    const button = page.locator('[data-speech-kind="example"]').first();
    await button.click();
    await expect.poll(() => page.evaluate(() => (window as any).__fallback?.lang)).toBe('ja-JP');
    expect(await page.evaluate(() => (window as any).__fallback.text)).toBe(await button.getAttribute('data-speech'));
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  test(`${locale}: shared pages fit mobile and preserve topic/source links`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['', 'topics/', 'topics/ai-agent/', 'knowledge/', 'interview/', 'japanese/', 'japanese/2026-09-07/']) {
      await page.goto(`${root}${route}`);
      await expect(page.locator('main h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
    }
    await page.goto(root);
    await expect(page.locator('.top-item-link')).toHaveCount(5);
    await expect(page.locator('.topic-mini-card').first()).toHaveAttribute('href', `${root}topics/ai-agent/`);
    await page.locator('.topic-mini-card').first().click();
    const original = page.locator('.topic-article-row').first();
    await expect(original).toHaveAttribute('href', /^https:\/\//);
    await expect(original).toHaveAttribute('rel', 'noopener noreferrer');
  });
  });
}
