import { test, expect, type Page } from '@playwright/test';

// Exercise the actual built component; only network/media are deterministic.
async function openReport(page: Page, locale: 'zh' | 'ja') {
  await page.addInitScript((language) => localStorage.setItem('site-language', language), locale);
  await page.addInitScript(() => {
    const state: any = { audios: [], spoken: [], manifest: {}, resolve: null };
    (window as any).__audioRace = state;
    const originalFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.endsWith('/2026-09-18/interview-manifest.json')) return originalFetch(input, init);
      return new Promise((resolve, reject) => {
        state.resolve = () => resolve({ ok: true, json: async () => state.manifest } as Response);
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    }) as typeof fetch;
    class ControlledAudio extends EventTarget {
      url: string;
      playing = false;
      currentTime = 0;
      constructor(url: string) { super(); this.url = url; state.audios.push(this); }
      play() { this.playing = true; return Promise.resolve(); }
      pause() { this.playing = false; }
    }
    (window as any).Audio = ControlledAudio;
    (window as any).SpeechSynthesisUtterance = class { constructor(public text: string) {} };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [], addEventListener: () => {},
      speak: (utterance: any) => state.spoken.push(utterance), cancel: () => {},
    } });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const path = `/japan-it-ai-daily/${locale === 'ja' ? 'ja/' : ''}daily/2026-09-18/`;
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.locator('html')).toHaveAttribute('data-locale', locale);
  await expect(page).toHaveTitle(/2026/);
  await expect(page.locator('h1').first()).toBeVisible();
  await page.waitForFunction(() => typeof (window as any).__audioRace?.resolve === 'function');
  const buttons = page.locator('.report-speech-button');
  await expect(buttons.nth(1)).toBeVisible();
  const release = async (withAudio = true) => {
    await page.evaluate(async (withAudio) => {
      const state = (window as any).__audioRace;
      state.manifest = withAudio ? { interview: [...document.querySelectorAll<HTMLButtonElement>('.report-speech-button')]
        .map((button, index) => ({ text: button.dataset.speech, audio: `race-${index}.mp3` })) } : {};
      state.resolve();
      // Drain the controlled fetch/json microtasks, not a network timing guess.
      await new Promise(resolve => setTimeout(resolve, 0));
    }, withAudio);
  };
  return { buttons, release, errors };
}

for (const locale of ['zh', 'ja'] as const) {
  test.describe(`${locale} interview audio request ownership`, () => {
    test('slow manifest: A -> B starts only B and stop silences it', async ({ page }) => {
      const { buttons, release, errors } = await openReport(page, locale);
      await buttons.nth(0).click();
      await expect(buttons.nth(0)).toHaveAttribute('aria-busy', 'true');
      await buttons.nth(1).click();
      await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
      await release();
      expect(await page.evaluate(() => (window as any).__audioRace.audios.map((a: any) => a.url))).toHaveLength(1);
      await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
      await expect(buttons.nth(1)).not.toHaveAttribute('aria-busy', 'true');
      await buttons.nth(1).click();
      expect(await page.evaluate(() => (window as any).__audioRace.audios.some((a: any) => a.playing))).toBe(false);
      expect(errors).toEqual([]);
    });

    test('same button cancels pending playback before the manifest resolves', async ({ page }) => {
      const { buttons, release } = await openReport(page, locale);
      await buttons.nth(0).click();
      await buttons.nth(0).click();
      await release();
      expect(await page.evaluate(() => (window as any).__audioRace.audios.length)).toBe(0);
      expect(await page.evaluate(() => (window as any).__audioRace.spoken.length)).toBe(0);
      await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
      await expect(buttons.nth(0).locator('[data-audio-loading]')).toHaveCount(0);
    });

    test('pagehide invalidates pending work and remains active after restoration', async ({ page }) => {
      const { buttons, release } = await openReport(page, locale);
      await buttons.nth(0).click();
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await release();
      expect(await page.evaluate(() => (window as any).__audioRace.audios.length)).toBe(0);
      await buttons.nth(1).click();
      expect(await page.evaluate(() => (window as any).__audioRace.audios.length)).toBe(1);
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      expect(await page.evaluate(() => (window as any).__audioRace.audios.some((a: any) => a.playing))).toBe(false);
    });

    test('old audio errors cannot start fallback after switching', async ({ page }) => {
      const { buttons, release } = await openReport(page, locale);
      await release();
      await buttons.nth(0).click();
      await buttons.nth(1).click();
      await page.evaluate(() => (window as any).__audioRace.audios[0].dispatchEvent(new Event('error')));
      expect(await page.evaluate(() => (window as any).__audioRace.spoken.length)).toBe(0);
      await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
    });

    test('current audio error falls back once, with old audio paused', async ({ page }) => {
      const { buttons, release } = await openReport(page, locale);
      await release();
      await buttons.nth(0).click();
      await page.evaluate(() => {
        const audio = (window as any).__audioRace.audios[0];
        audio.dispatchEvent(new Event('error'));
        audio.dispatchEvent(new Event('error'));
      });
      expect(await page.evaluate(() => (window as any).__audioRace.spoken.length)).toBe(1);
      expect(await page.evaluate(() => (window as any).__audioRace.audios[0].playing)).toBe(false);
      await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true');
    });

    test('old utterance completion cannot clear a new request on the same button', async ({ page }) => {
      const { buttons, release } = await openReport(page, locale);
      await release(false);
      await buttons.nth(0).click();
      await buttons.nth(0).click();
      await buttons.nth(0).click();
      expect(await page.evaluate(() => (window as any).__audioRace.spoken.length)).toBe(2);
      await page.evaluate(() => (window as any).__audioRace.spoken[0].onend());
      await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true');
    });
  });
}

test('mobile: loading is visible, cancellable and leaves the original label intact', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { buttons, release, errors } = await openReport(page, 'ja');
  const originalLabel = await buttons.nth(0).innerText();
  await buttons.nth(0).click();
  await expect(buttons.nth(0)).toContainText('読み込み中');
  await page.screenshot({ path: info.outputPath('audio-loading-mobile.png') });
  await buttons.nth(0).click();
  await release();
  await expect(buttons.nth(0)).toHaveText(originalLabel);
  expect(errors).toEqual([]);
});
