import { test, expect } from '@playwright/test';
import { readStructuredInterview } from '../../scripts/structured-interview.mjs';

const pilot = readStructuredInterview('2026-09-18')!;
for (const locale of ['zh', 'ja'] as const) {
  for (const width of [1440, 390]) {
    test(`${locale} structured interview renders unchanged content at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const path = `/japan-it-ai-daily/${locale === 'ja' ? 'ja/' : ''}interview/`;
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('astro-error-overlay, vite-error-overlay')).toHaveCount(0);
      const day = page.locator('.interview-day').filter({ has: page.locator('a.daily-link[href$="/daily/2026-09-18/"]') });
      await expect(day).toBeVisible();
      await expect(day.locator('.interview-answer-card p')).toHaveText(pilot.interview.map((item: any) => item.answer));
      await expect(day.locator('.review-q p')).toHaveText(pilot.review.map((item: any) => item.question));
      await expect(day.locator('.review-points p')).toHaveText(pilot.review.map((item: any) => item.points[locale]));
      await page.screenshot({ path: info.outputPath(`structured-interview-${locale}-${width}.png`) });
      expect(errors).toEqual([]);
    });
  }
}
