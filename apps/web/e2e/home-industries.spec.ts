import { expect, test } from '@playwright/test';
import { LOCALES } from '../i18n/config';

const base = process.env.QA_BASE_URL || 'http://localhost:3100';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local app only');

for (const locale of LOCALES) {
  for (const width of [375, 390, 694, 768, 1280]) {
    for (const colorScheme of locale === 'en'
      ? (['light', 'dark'] as const)
      : (['dark'] as const)) {
      test(`home industries fit without clipped labels: ${locale}, ${width}px, ${colorScheme}`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.route('**/*', (route) =>
          new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
        );
        await page.goto(`${base}${locale === 'en' ? '/' : `/${locale}`}`);
        await page.evaluate(() => document.fonts.ready);
        const cards = page.locator('#industries .use');
        await expect(cards).toHaveCount(3);
        // Measure before scrolling to a card: scrollIntoView can hide a broken horizontal strip.
        const bounds = await cards.evaluateAll((elements) =>
          elements.map((element) => {
            const { left, right } = element.getBoundingClientRect();
            return { left, right };
          }),
        );
        await page.locator('#industries').evaluate((element) => {
          window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 72);
        });
        await testInfo.attach('industries overview', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        for (const [index, rect] of bounds.entries()) {
          expect(rect.left, `card ${index + 1} left edge`).toBeGreaterThanOrEqual(0);
          expect(rect.right, `card ${index + 1} right edge`).toBeLessThanOrEqual(width);
        }
        for (const card of await cards.all()) {
          await card.scrollIntoViewIfNeeded();
          const panel = card.locator('.panel');
          if (await card.locator('.panel--arch').count()) {
            await expect(card.locator('.pins li.is-on')).toHaveCount(4);
            for (const pin of await card.locator('.pins span').all()) {
              await expect(pin).toHaveCSS('opacity', '1');
            }
          }
          // Check rendered text, including nowrap labels, against its panel and own box.
          const clipped = await panel.evaluate((element) => {
            const frame = element.getBoundingClientRect();
            const labels = element.querySelectorAll(
              '.pins span, .kelvin > span:not(.kelvin__track), .shop__name, .shop__meta, .shop__btn, .inspector__head span, .inspector dt, .inspector dd, .tag',
            );
            return Array.from(labels).flatMap((label) => {
              const box = label.getBoundingClientRect();
              const range = document.createRange();
              range.selectNodeContents(label);
              const text = range.getBoundingClientRect();
              const isClipped =
                box.left < frame.left - 1 ||
                box.right > frame.right + 1 ||
                text.left < box.left - 1 ||
                text.right > box.right + 1 ||
                text.top < frame.top - 1 ||
                text.bottom > frame.bottom + 1;
              return isClipped ? [label.textContent] : [];
            });
          });
          expect(clipped).toEqual([]);
          await testInfo.attach((await card.locator('h3').textContent()) || 'industry card', {
            body: await card.screenshot(),
            contentType: 'image/png',
          });
        }
        expect(
          await page.evaluate(() => ({
            document: document.documentElement.scrollWidth,
            body: document.body.scrollWidth,
          })),
        ).toEqual({ document: width, body: width });
      });
    }
  }
}
