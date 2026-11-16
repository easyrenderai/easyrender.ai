import { mkdir } from 'node:fs/promises';
import { chromium, expect, test } from '@playwright/test';

const base = process.env.THEME_BASE_URL || 'http://localhost:3148';
const output = process.env.EVIDENCE_DIR || '../../.data/site-wide-dark';
const pages = [
  ['/pricing', 'pricing'],
  ['/', 'home'],
  ['/learn/how-to-make-a-3d-model-from-photos', 'guide'],
  ['/sign-in', 'sign-in'],
] as const;

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [375, 1440]) {
    test(`studio palette with ${colorScheme} OS at ${width}px`, async () => {
      test.setTimeout(120_000);
      expect(['127.0.0.1', 'localhost']).toContain(new URL(base).hostname);
      await mkdir(output, { recursive: true });
      // Isolate viewport captures: Chromium can fail a desktop full-page capture after mobile.
      const browser = await chromium.launch();
      try {
        const context = await browser.newContext({
          colorScheme,
          reducedMotion: 'reduce',
          viewport: { width, height: 900 },
        });
        await context.route('**/*', (route) =>
          new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
        );
        const page = await context.newPage();
        for (const [path, name] of pages) {
          await page.goto(`${base}${path}`);
          await expect(page.locator(name === 'sign-in' ? 'form' : 'h1')).toBeVisible();
          await page.screenshot({
            path: `${output}/${name}-${colorScheme}-${width}.png`,
            fullPage: name === 'pricing' || name === 'sign-in',
          });
          await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
          await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 11)');
          await expect(page.locator('body')).toHaveCSS('color', 'rgb(236, 235, 231)');
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
          expect(
            await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
          ).toBe(true);
          if (name === 'home') {
            await expect(page.locator('.hero__lead')).toHaveCSS('color', 'rgb(144, 144, 149)');
          }
          if (name === 'sign-in') {
            const email = page.locator('input[type=email]');
            await expect(email).toHaveCSS('color', 'rgb(236, 235, 231)');
            // Existing shadcn dark variants must apply even with a light OS preference.
            await expect(email).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
            await email.focus();
            await expect(email).toBeFocused();
            await expect(email).not.toHaveCSS('box-shadow', 'none');
          }
        }
      } finally {
        await browser.close();
      }
    });
  }
}
