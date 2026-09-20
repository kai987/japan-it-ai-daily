import { test, expect } from '@playwright/test';

const questions = [
  'Claude CodeのMCP起動待ちを0にすれば常に速くなりますか。',
  'RAGの差分更新でURLをIDにする場合、どんな更新を取りこぼしますか。',
  'Agentic SOCでHuman Approvalを残すべき箇所はどこですか。',
];

for (const locale of ['zh', 'ja']) {
  test(`${locale}: inline review labels retain three question-only speech controls`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /Content Security Policy|Refused to execute/i.test(message.text())) errors.push(message.text());
    });
    await page.addInitScript((language) => {
      localStorage.setItem('site-language', language);
      Object.defineProperty(window, 'speechSynthesis', { value: {
        getVoices: () => [], cancel: () => {},
        speak: (utterance: SpeechSynthesisUtterance) => {
          (window as any).__reviewSpeech = { text: utterance.text, lang: utterance.lang };
        },
      } });
    }, locale);
    // The speech interaction is tested with a deterministic browser-TTS stub,
    // not as a claim of audible playback or a newly generated recording.
    await page.route(/\.mp3(?:\?|$)/, (route) => route.abort());
    const root = `/japan-it-ai-daily/${locale === 'ja' ? 'ja/' : ''}`;
    await page.goto(`${root}daily/2026-09-18/`);
    await expect(page.locator('article.prose')).toBeVisible();
    await expect(page.locator('.report-speech-button')).toHaveCount(13);
    const review = page.locator('.report-speech-button[aria-label="面接復習の質問を読み上げる"]');
    await expect(review).toHaveCount(3);
    for (const [index, question] of questions.entries()) {
      const button = review.nth(index);
      await expect(button).toHaveAttribute('data-speech', question);
      await button.click();
      await expect.poll(() => page.evaluate(() => (window as any).__reviewSpeech)).toEqual({ text: question, lang: 'ja-JP' });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'false');
    }
    expect(errors).toEqual([]);
  });
}
