import { test, expect } from '@playwright/test';
import { contentDates } from '../../scripts/content-files.mjs';
const reportDays = contentDates(new URL('../../', import.meta.url).pathname).length;
for (const locale of ['zh','ja']) {
  const root=`/japan-it-ai-daily/${locale==='ja'?'ja/':''}`;
  test(`${locale}: learning issue, new/review totals and inspectable date frequency`,async({page},testInfo)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(lang=>localStorage.setItem('site-language',lang),locale);
    await page.goto(`${root}japanese/2026-09-18/`);
    await expect(page.locator('article h1')).toContainText('（第38号）');
    await expect(page.locator('.vocabulary-card')).toHaveCount(20);
    await expect(page.locator('.grammar-card')).toHaveCount(7);
    await expect(page.locator('.vocabulary-card[data-study-kind="review"]')).toHaveCount(3);
    await expect(page.locator('.grammar-card[data-study-kind="review"]')).toHaveCount(7);

    const reviewMeta=page.locator('.vocabulary-card[data-study-kind="review"] .study-meta').first();
    await expect(reviewMeta).toHaveCSS('text-align','right');
    await expect(reviewMeta.locator('.study-kind')).toHaveText('復習');
    const levelBadge=reviewMeta.locator('.level-badge');
    const studyKind=reviewMeta.locator('.study-kind');
    const frequency=reviewMeta.locator('.study-frequency');
    await expect(frequency).toHaveAttribute('data-frequency-total',String(reportDays));
    await expect(frequency.locator('.frequency-primary')).toHaveText(/出現頻度：\d+\.\d%/);
    await expect(frequency.locator('.frequency-ratio')).toHaveText(new RegExp(`^（\\d+/${reportDays}日）$`));

    const [badgeBox,kindBox,primaryBox,ratioBox]=await Promise.all([
      levelBadge.boundingBox(),
      studyKind.boundingBox(),
      frequency.locator('.frequency-primary').boundingBox(),
      frequency.locator('.frequency-ratio').boundingBox(),
    ]);
    const right=(box:{x:number;width:number}|null)=>box!.x+box!.width;
    expect(Math.abs(right(badgeBox)-right(kindBox))).toBeLessThan(2);
    expect(Math.abs(right(primaryBox)-right(ratioBox))).toBeLessThan(2);
    expect(ratioBox!.y).toBeGreaterThan(primaryBox!.y);

    await frequency.locator('summary').click();
    await expect(frequency).toHaveAttribute('open','');
    await expect(frequency).toContainText('2026-09-18');
    const b=await levelBadge.boundingBox(),f=await frequency.boundingBox();
    expect(f!.y).toBeGreaterThan(b!.y);
    await frequency.locator('summary').click();

    await page.locator('.vocabulary-card').first().scrollIntoViewIfNeeded();
    await page.screenshot({path:testInfo.outputPath('study-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    await page.locator('.grammar-card[data-study-kind="review"]').first().scrollIntoViewIfNeeded();
    const mobileMeta=page.locator('.grammar-card[data-study-kind="review"] .study-meta').first();
    await expect(mobileMeta.locator('.frequency-ratio')).toBeVisible();
    const mobilePrimary=await mobileMeta.locator('.frequency-primary').boundingBox();
    const mobileRatio=await mobileMeta.locator('.frequency-ratio').boundingBox();
    expect(mobileRatio!.y).toBeGreaterThan(mobilePrimary!.y);
    await page.screenshot({path:testInfo.outputPath('study-mobile.png')});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
  test(`${locale}: report retains 13 speech controls while review supplements and issue appear`,async({page})=>{
    await page.addInitScript(lang=>localStorage.setItem('site-language',lang),locale);
    await page.goto(`${root}daily/2026-09-18/`);
    await expect(page.locator('.report-speech-button')).toHaveCount(13);
    await expect(page.locator('[data-review-supplement="vocabulary"] .study-card')).toHaveCount(3);
    await expect(page.locator('[data-review-supplement="grammar"] .study-card')).toHaveCount(7);
    await expect(page.locator('.report-reference-frequency')).toHaveCount(17);
    expect(await page.locator('article.prose').evaluate(el=>{
      const review=el.querySelector('[data-review-supplement="grammar"]');
      const heading=[...el.querySelectorAll('h2')].find(h=>h.textContent?.startsWith('C-4'));
      return Boolean(review && heading && (review.compareDocumentPosition(heading)&Node.DOCUMENT_POSITION_FOLLOWING));
    })).toBe(true);
  });
}