import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { HTML_LANG, LOCALES } from '../i18n/config';
import { isPublished, ROUTES } from '../lib/seo/routes';

const base = process.env.PRICING_E2E_URL || 'http://localhost:3159';
const output = process.env.EVIDENCE_DIR || '../../.data/logos-placement';
test.skip(!process.env.PRICING_E2E_URL, 'Requires an isolated local app');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local app only');

for (const kind of ['home', 'api', 'mcp'] as const) {
  for (const locale of LOCALES) {
    if (!isPublished(kind, locale)) continue;
    test(`${locale} ${kind}: compatibility strip immediately below hero and above fold`, async ({
      page,
      context,
    }) => {
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === new URL(base).origin
          ? route.continue()
          : route.abort(),
      );
      await context.addCookies([{ name: 'er_home_locale', value: locale, url: base }]);
      await page.goto(`${base}${ROUTES[kind].paths[locale]}`);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('html')).toHaveAttribute('lang', HTML_LANG[locale]);
      await expect(page.locator('.marquee')).toHaveCount(1);
      const strip = page.locator('.hero + .marquee');
      await expect(strip).toBeVisible();
      await expect(strip.locator('li:not([aria-hidden])')).toHaveText([
        'GLB',
        'USDZ',
        'Blender',
        'SketchUp',
        'three.js',
        'Shopify',
        'ARKit',
        'ARCore',
      ]);
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 1366, height: 768 },
        { width: 375, height: 667 },
        { width: 768, height: 1024 },
      ]) {
        await page.setViewportSize(viewport);
        for (const reducedMotion of ['reduce', 'no-preference'] as const) {
          await page.emulateMedia({ reducedMotion });
          await page.evaluate(() => window.scrollTo(0, 0));
          const bounds = await strip.boundingBox();
          if (!bounds) throw new Error('Compatibility strip missing');
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
          expect(bounds.height).toBeLessThanOrEqual(64);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(viewport.width);
          const hero = await page.locator('.hero').boundingBox();
          if (!hero) throw new Error('Hero missing');
          expect(Math.abs(bounds.y - (hero.y + hero.height))).toBeLessThanOrEqual(1);
          if (reducedMotion === 'reduce') {
            await expect(strip.locator('.marquee__row')).toHaveCSS('animation-name', 'none');
            await expect(strip.locator('li[aria-hidden]').first()).toBeHidden();
            if (viewport.width === 375) {
              await strip.focus();
              await page.keyboard.press('ArrowRight');
              await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
              await strip.evaluate((el) => {
                el.scrollLeft = 0;
              });
            }
          } else {
            await strip.focus();
            await expect(strip.locator('.marquee__row')).toHaveCSS(
              'animation-play-state',
              'paused',
            );
          }
        }
        if (locale === 'en' || locale === 'es') {
          await strip.evaluate((el) => el.blur());
          await mkdir(output, { recursive: true });
          await page.screenshot({ path: `${output}/${locale}-${kind}-${viewport.width}.png` });
        }
      }
    });
  }
}
