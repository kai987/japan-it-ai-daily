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

    const denseCard=page.locator('.vocabulary-card').filter({hasText:'検証する'}).first();
    const denseFrequency=denseCard.locator('.study-frequency');
    await denseFrequency.locator('summary').click();
    const dateGrid=denseFrequency.locator('.frequency-dates');
    const dateRows=dateGrid.locator('.frequency-date-row');
    expect(await dateRows.count()).toBeGreaterThan(1);
    const rowTexts=await dateRows.allTextContents();
    expect(rowTexts[0]).toMatch(/^\\d{4}-\\d{2}-\\d{2} \/ \\d{4}-\\d{2}-\\d{2}$/);
    expect(rowTexts.every(text=>!text.trim().endsWith('/'))).toBe(true);
    expect(rowTexts.every(text=>text.split(' / ').length<=2)).toBe(true);
    const note=denseFrequency.locator('.frequency-details > p').first();
    const widthMetrics=await denseFrequency.evaluate(el=>{
      const noteEl=el.querySelector('.frequency-details > p') as HTMLElement;
      const rowEl=el.querySelector('.frequency-date-row') as HTMLElement;
      const range=document.createRange();
      range.selectNodeContents(rowEl);
      return {
        noteWidth:noteEl.getBoundingClientRect().width,
        rowTextWidth:range.getBoundingClientRect().width,
      };
    });
    expect(widthMetrics.noteWidth).toBeLessThanOrEqual(widthMetrics.rowTextWidth+1);
    await denseFrequency.locator('summary').click();

    await page.locator('.vocabulary-card').first().scrollIntoViewIfNeeded();
    await page.screenshot({path:testInfo.outputPath('study-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    const mobileCard=page.locator('.vocabulary-card').filter({hasText:'一分一秒を争う'}).first();
    await mobileCard.scrollIntoViewIfNeeded();
    const mobileHeader=mobileCard.locator('.study-card-header');
    const mobileLeft=mobileHeader.locator(':scope > :first-child');
    const mobileMeta=mobileHeader.locator('.study-meta');
    const mobileBadge=mobileMeta.locator('.level-badge');
    await expect(mobileBadge).toHaveCSS('white-space','nowrap');
    await expect(mobileMeta.locator('.frequency-ratio')).toBeVisible();
    const [headerBox,leftBox,metaBox,badgeMobileBox,mobilePrimary,mobileRatio]=await Promise.all([
      mobileHeader.boundingBox(),
      mobileLeft.boundingBox(),
      mobileMeta.boundingBox(),
      mobileBadge.boundingBox(),
      mobileMeta.locator('.frequency-primary').boundingBox(),
      mobileMeta.locator('.frequency-ratio').boundingBox(),
    ]);
    expect(Math.abs(leftBox!.y-metaBox!.y)).toBeLessThan(3);
    expect(Math.abs(leftBox!.x-headerBox!.x)).toBeLessThan(3);
    expect(Math.abs((metaBox!.x+metaBox!.width)-(headerBox!.x+headerBox!.width))).toBeLessThan(3);
    expect(metaBox!.width/headerBox!.width).toBeLessThan(0.4);
    expect(leftBox!.width).toBeGreaterThan(metaBox!.width);
    expect(badgeMobileBox!.height).toBeLessThan(32);
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