import { test, expect, type Page } from '@playwright/test';

// Real rendered lessons and controller; only manifest arrival and media events
// are controlled so race conditions can be reproduced without timing guesses.
async function openLesson(page: Page, locale: 'zh' | 'ja') {
  await page.addInitScript((language) => localStorage.setItem('site-language', language), locale);
  await page.addInitScript(() => {
    const state: any = { audios: [], spoken: [], cancellations: 0, manifest: {}, resolve: null };
    (window as any).__lessonAudio = state;
    const originalFetch = window.fetch.bind(window);
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.endsWith('/2026-09-18/manifest.json')) return originalFetch(input, init);
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
      speak: (utterance: any) => state.spoken.push(utterance),
      cancel: () => { state.cancellations += 1; },
    } });
  });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const path = `/japan-it-ai-daily/${locale === 'ja' ? 'ja/' : ''}japanese/2026-09-18/`;
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page).toHaveTitle(/2026/);
  await expect(page.locator('h1').first()).toBeVisible();
  await page.waitForFunction(() => typeof (window as any).__lessonAudio?.resolve === 'function');
  const buttons = page.locator('.speech-button[data-speech-kind="word"]');
  const release = async (withAudio = true) => {
    await page.evaluate(async (withAudio) => {
      const state = (window as any).__lessonAudio;
      state.manifest = withAudio ? { items: [...document.querySelectorAll<HTMLButtonElement>('.speech-button[data-speech-kind="word"]')]
        .map((button, index) => ({ term: button.dataset.vocabularyTerm, reading: button.dataset.vocabularyReading,
          exampleJa: '', word: `race-${index}.mp3`, wordSha256: 'a'.repeat(64), audioDate: '2026-08-12' })) } : {};
      state.resolve();
      await new Promise(resolve => setTimeout(resolve, 0));
    }, withAudio);
  };
  return { buttons, release, errors };
}

for (const locale of ['zh', 'ja'] as const) {
  test.describe(`${locale} lesson audio request ownership`, () => {
    test('first click waits for recording metadata and switching starts only the latest versioned source', async ({ page }) => {
      const { buttons, release, errors } = await openLesson(page, locale);
      await buttons.nth(0).click();
      await expect(buttons.nth(0)).toHaveAttribute('aria-busy', 'true');
      expect(await page.evaluate(() => (window as any).__lessonAudio.spoken.length)).toBe(0);
      await buttons.nth(1).click();
      await release();
      const urls = await page.evaluate(() => (window as any).__lessonAudio.audios.map((a: any) => a.url));
      expect(urls).toHaveLength(1);
      const mediaPath = urls[0].startsWith('https:')
        ? `/japanese/2026-08-12/race-1--${'a'.repeat(64)}.mp3`
        : `/japanese/2026-08-12/race-1.mp3?v=${'a'.repeat(64)}`;
      expect(urls[0].endsWith(mediaPath)).toBe(true);
      await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
      await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'true');
      await buttons.nth(1).click();
      expect(await page.evaluate(() => (window as any).__lessonAudio.audios.some((a: any) => a.playing))).toBe(false);
      expect(errors).toEqual([]);
    });

    test('same button cancels pending playback', async ({ page }) => {
      const { buttons, release } = await openLesson(page, locale);
      await buttons.nth(0).click();
      await buttons.nth(0).click();
      await release();
      expect(await page.evaluate(() => (window as any).__lessonAudio.audios.length)).toBe(0);
      expect(await page.evaluate(() => (window as any).__lessonAudio.spoken.length)).toBe(0);
      await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
      await expect(buttons.nth(0)).not.toHaveAttribute('aria-busy', 'true');
    });

    test('old fallback completion cannot clear a replay on the same button', async ({ page }) => {
      const { buttons, release } = await openLesson(page, locale);
      await release(false);
      await buttons.nth(0).click();
      await buttons.nth(0).click();
      await buttons.nth(0).click();
      expect(await page.evaluate(() => (window as any).__lessonAudio.spoken.length)).toBe(2);
      await page.evaluate(() => (window as any).__lessonAudio.spoken[0].onend());
      await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true');
      await buttons.nth(0).click();
      await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
      expect(await page.evaluate(() => (window as any).__lessonAudio.spoken.length)).toBe(2);
    });

    test('recording failure falls back once while stale recording errors stay stopped', async ({ page }) => {
      const { buttons, release } = await openLesson(page, locale);
      await release();
      await buttons.nth(0).click();
      await buttons.nth(1).click();
      await page.evaluate(() => (window as any).__lessonAudio.audios[0].dispatchEvent(new Event('error')));
      expect(await page.evaluate(() => (window as any).__lessonAudio.spoken.length)).toBe(0);
      await page.evaluate(() => {
        const audio = (window as any).__lessonAudio.audios[1];
        audio.dispatchEvent(new Event('error'));
        audio.dispatchEvent(new Event('error'));
      });
      expect(await page.evaluate(() => (window as any).__lessonAudio.spoken.length)).toBe(1);
      expect(await page.evaluate(() => (window as any).__lessonAudio.audios[1].playing)).toBe(false);
      await expect(buttons.nth(1)).toHaveAttribute('data-audio-provider', 'browser-tts');
      await buttons.nth(1).click();
      await expect(buttons.nth(1)).toHaveAttribute('aria-pressed', 'false');
    });

    test('pagehide invalidates pending playback and keeps stopping after a restore', async ({ page }) => {
      const { buttons, release } = await openLesson(page, locale);
      await buttons.nth(0).click();
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await release();
      expect(await page.evaluate(() => (window as any).__lessonAudio.audios.length)).toBe(0);
      await buttons.nth(1).click();
      expect(await page.evaluate(() => (window as any).__lessonAudio.audios.length)).toBe(1);
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      expect(await page.evaluate(() => (window as any).__lessonAudio.audios.some((a: any) => a.playing))).toBe(false);
    });
  });
}

test('lesson manifest timeout releases loading into Japanese fallback', async ({ page }) => {
  await page.clock.install();
  const { buttons, errors } = await openLesson(page, 'ja');
  await buttons.nth(0).click();
  await expect(buttons.nth(0)).toHaveAttribute('aria-busy', 'true');
  await page.clock.fastForward(10001);
  await expect(buttons.nth(0)).not.toHaveAttribute('aria-busy', 'true');
  expect(await page.evaluate(() => (window as any).__lessonAudio.spoken.map((u: any) => u.lang))).toEqual(['ja-JP']);
  await buttons.nth(0).click();
  await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('mobile lesson loading preserves button dimensions and can be cancelled', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { buttons, release, errors } = await openLesson(page, 'ja');
  const original = await buttons.nth(0).boundingBox();
  await buttons.nth(0).click();
  await expect(buttons.nth(0)).toContainText('読み込み中');
  const loading = await buttons.nth(0).boundingBox();
  expect(original).not.toBeNull();
  expect(loading).not.toBeNull();
  // Chromium can introduce subpixel rounding when scrolling the button into view.
  expect(loading!.width).toBeCloseTo(original!.width, 2);
  expect(loading!.height).toBeCloseTo(original!.height, 2);
  expect(await buttons.nth(0).evaluate((button) => getComputedStyle(button, '::after').content)).toBe('""');
  await page.screenshot({ path: info.outputPath('lesson-audio-loading-mobile.png') });
  await buttons.nth(0).click();
  await release();
  await expect(buttons.nth(0).locator('[data-audio-loading]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
