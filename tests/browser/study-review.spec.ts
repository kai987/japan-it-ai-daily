import { test, expect } from '@playwright/test';
import { getStudyArchive } from '../../scripts/learning-review.mjs';
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

    const denseCard=page.locator('.vocabulary-card[data-study-kind="review"]').filter({hasText:'検証する'}).first();
    const denseFrequency=denseCard.locator('.study-frequency');
    await denseFrequency.locator('summary').click();
    const dateGrid=denseFrequency.locator('.frequency-dates');
    const dateRows=dateGrid.locator('.frequency-date-row');
    const dateLinks=dateGrid.locator('.frequency-date-link');
    expect(await dateRows.count()).toBeGreaterThan(1);
    expect(await dateLinks.count()).toBeGreaterThan(1);
    const firstDateLink=dateLinks.filter({hasText:'2026-08-12'}).first();
    await expect(firstDateLink).toHaveAttribute('target','_blank');
    await expect(firstDateLink).toHaveAttribute('rel',/noopener/);
    await expect(firstDateLink).toHaveAttribute('href',/\/ja\/daily\/2026-08-12\/\?studyFocus=/);
    if(locale==='zh'){
      const popupPromise=page.waitForEvent('popup');
      await firstDateLink.click();
      const popup=await popupPromise;
      await popup.waitForLoadState('domcontentloaded');
      await expect(popup).toHaveURL(/\/ja\/daily\/2026-08-12\/\?studyFocus=/);
      const focused=popup.locator('#study-focus-target');
      await expect(focused).toBeVisible();
      expect((await focused.textContent())?.normalize('NFKC')).toContain('検証');
      await expect.poll(async()=>focused.evaluate(el=>{
        const rect=el.getBoundingClientRect();
        return rect.top < innerHeight && rect.bottom > 0;
      })).toBe(true);
      await popup.close();
    }
    await denseFrequency.locator('summary').click();

    const newCard=page.locator('.vocabulary-card[data-study-kind="new"]').first();
    const newFrequency=newCard.locator('.study-frequency');
    await newFrequency.locator('summary').click();
    const newDateLinks=newFrequency.locator('.frequency-date-link');
    expect(await newDateLinks.count()).toBeGreaterThan(0);
    const newDateLink=newDateLinks.first();
    await expect(newDateLink).toHaveAttribute('target','_blank');
    await expect(newDateLink).toHaveAttribute('rel',/noopener/);
    await expect(newDateLink).toHaveAttribute('href',/\/ja\/daily\/\d{4}-\d{2}-\d{2}\/\?studyFocus=/);
    if(locale==='zh'){
      const popupPromise=page.waitForEvent('popup');
      await newDateLink.click();
      const popup=await popupPromise;
      await popup.waitForLoadState('domcontentloaded');
      await expect(popup).toHaveURL(/\/ja\/daily\/\d{4}-\d{2}-\d{2}\/\?studyFocus=/);
      const focused=popup.locator('#study-focus-target');
      await expect(focused).toBeVisible();
      await popup.close();
    }
    await newFrequency.locator('summary').click();

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
for (const locale of ['zh','ja']) {
  const prefix=`/japan-it-ai-daily/${locale==='ja'?'ja/':''}`;
  test(`${locale}: historical grammar range and legitimate shortfall render`,async({page},testInfo)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(lang=>localStorage.setItem('site-language',lang),locale);
    for(const date of ['2026-08-13','2026-08-14','2026-08-15','2026-09-09']) {
      const data=getStudyArchive().lessons[date][locale];
      await page.goto(`${prefix}japanese/${date}/`);
      await expect(page.locator('[data-grammar-range]')).toContainText('5～8');
      await expect(page.locator('.grammar-card')).toHaveCount(data.studyGrammarCount);
      await expect(page.locator('.grammar-card[data-study-kind="review"]')).toHaveCount(data.reviewGrammar.length);
      await expect(page.locator('.vocabulary-card[data-study-kind="review"]')).toHaveCount(0);
      if(data.reviewGrammarNote)await expect(page.getByText(data.reviewGrammarNote,{exact:true})).toBeVisible();
    }
    // Historical additions retain date links and true same-day evidence.
    const review=page.locator('.grammar-card[data-study-kind="review"]').first();
    await review.scrollIntoViewIfNeeded();
    await expect(review.locator('[data-review-evidence]')).toBeVisible();
    await review.locator('.study-frequency summary').click();
    await expect(review.locator('.frequency-date-link').first()).toHaveAttribute('target','_blank');
    await review.locator('.study-frequency summary').click();
    await page.screenshot({path:testInfo.outputPath('grammar-history-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    await review.scrollIntoViewIfNeeded();
    await page.screenshot({path:testInfo.outputPath('grammar-history-mobile.png')});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.goto(`${prefix}daily/2026-08-15/`);
    await expect(page.locator('[data-review-supplement="grammar"] .study-card')).toHaveCount(1);
    await expect(page.locator('[data-review-shortfall]')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
