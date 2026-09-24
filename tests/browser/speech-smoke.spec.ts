import { test, expect } from '@playwright/test';

const cases = [
  ['zh', '2026-09-18', 'legacy'],
  ['ja', '2026-09-18', 'legacy'],
  ['zh', '2026-09-24', 'current'],
  ['ja', '2026-09-24', 'current'],
] as const;

for (const [locale, date, format] of cases) {
  test(`${locale} ${format} report has one speech owner and 13 unique controls`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((language) => localStorage.setItem('site-language', language), locale);
    const root = `/japan-it-ai-daily/${locale === 'ja' ? 'ja/' : ''}`;
    await page.goto(`${root}daily/${date}/`);
    await expect(page.locator('article.prose')).toBeVisible();

    const all = page.locator('.report-speech-button');
    await expect(all).toHaveCount(13);
    await expect(page.locator('.report-speech-button[data-speech-kind="interview"]')).toHaveCount(10);
    await expect(page.locator('.report-speech-button[data-speech-kind="review"]')).toHaveCount(3);

    const speech = await all.evaluateAll((buttons) =>
      buttons.map((button) => (button as HTMLButtonElement).dataset.speech?.replace(/\s+/g, ' ').trim() || ''),
    );
    expect(speech.every(Boolean)).toBe(true);
    expect(new Set(speech).size).toBe(13);
    expect(errors).toEqual([]);
  });
}
