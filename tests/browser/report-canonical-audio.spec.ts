import { test, expect } from '@playwright/test';
import { readStructuredInterview } from '../../scripts/structured-interview.mjs';
import interviewManifest from '../../public/audio/japanese/2026-10-02/interview-manifest.json' with { type: 'json' };

const date = '2026-10-02';
const canonical = readStructuredInterview(date)!;
const manifest = JSON.stringify(interviewManifest);
const answer = interviewManifest.interview.find(item => item.type === 'answer' && item.index === 1)!;

for (const locale of ['zh', 'ja'] as const) {
  test(`${locale}: typographic command flag keeps the canonical recorded audio`, async ({ page }) => {
    await page.addInitScript((locale) => {
      localStorage.setItem('site-language', locale);
      const state = { urls: [] as string[], spoken: [] as string[] };
      (window as any).__canonicalAudio = state;
      (window as any).Audio = class extends EventTarget {
        currentTime = 0;
        constructor(url: string) { super(); state.urls.push(url); }
        play() { return Promise.resolve(); }
        pause() {}
      };
      (window as any).SpeechSynthesisUtterance = class { constructor(public text: string) {} };
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
        getVoices: () => [], addEventListener() {}, cancel() {},
        speak: (utterance: any) => state.spoken.push(utterance.text),
      } });
    }, locale);
    await page.route(`**/${date}/interview-manifest.json`, route => route.fulfill({ contentType: 'application/json', body: manifest }));
    await page.goto(`/japan-it-ai-daily/${locale === 'ja' ? 'ja/' : ''}daily/${date}/`);
    const buttons = page.locator('.report-speech-button');
    await expect(buttons).toHaveCount(13);
    const speech = await buttons.evaluateAll(buttons => buttons.map(button => (button as HTMLButtonElement).dataset.speech));
    expect(speech).toEqual([
      ...canonical.interview.flatMap(item => [item.question, item.answer]),
      ...canonical.review.map(item => item.question),
    ]);
    const block = page.locator('#interview-answer-01');
    await expect(block.locator('p')).toContainText('–bare');
    const button = block.locator('.report-speech-button');
    await expect(button).toHaveAttribute('data-speech', canonical.interview[0].answer);
    await button.click();
    await expect.poll(() => page.evaluate(() => (window as any).__canonicalAudio.urls.length)).toBe(1);
    const state = await page.evaluate(() => (window as any).__canonicalAudio);
    expect(state.spoken).toEqual([]);
    const suffixes = [
      `/japanese/${date}/${answer.audio}?v=${answer.audioSha256}`,
      `/japanese/${date}/${answer.audio.slice(0, -4)}--${answer.audioSha256}.mp3`,
    ];
    expect(suffixes.some(suffix => state.urls[0].endsWith(suffix))).toBe(true);
  });
}
