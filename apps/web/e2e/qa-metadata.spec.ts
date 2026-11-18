import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { LOCALES } from '../i18n/config';
import { isPublished, ROUTES } from '../lib/seo/routes';

const base = process.env.QA_BASE_URL || 'http://localhost:3177';
const output = process.env.EVIDENCE_DIR || '/tmp/er-followup-metadata-evidence';
test.skip(!process.env.QA_BASE_URL, 'Requires an isolated local app without provider credentials');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local app only');
test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
  );
});
test('all locale home, ecommerce and auth metadata are short and branded', async ({ page }) => {
  test.setTimeout(120_000);
  for (const locale of LOCALES) {
    const prefix = locale === 'en' ? '' : `/${locale}`;
    for (const path of [
      ROUTES.home.paths[locale],
      ...(isPublished('ecommerce', locale) ? [ROUTES.ecommerce.paths[locale]] : []),
      `${prefix}/sign-in`,
      `${prefix}/sign-up`,
    ]) {
      expect((await page.goto(`${base}${path}`))?.status()).toBe(200);
      await expect(page).toHaveTitle(/Easy Render/);
      expect((await page.title()).length).toBeLessThanOrEqual(60);
      if (path.endsWith('/sign-in') || path.endsWith('/sign-up')) {
        expect(await page.title()).not.toMatch(/Photo to 3D|Easy Render \|/);
      } else {
        await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
          'content',
          'Easy Render',
        );
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
          'content',
          await page.title(),
        );
      }
    }
  }
  for (const path of [
    '/forgot-password',
    '/verify-email',
    '/forgot-password?locale=es',
    '/verify-email?locale=es',
  ]) {
    expect((await page.goto(`${base}${path}`))?.status()).toBe(200);
    await expect(page).toHaveTitle(/ · Easy Render$/);
    expect((await page.title()).length).toBeLessThanOrEqual(60);
  }
});
test('public showcase exposes its own social image', async ({ page }) => {
  await page.goto(`${base}/r/demo-vase`);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    await page.title(),
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /\/showcase\/vase/,
  );
});
test('Spanish store setup separates assisted install, manual install and free preview', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${base}/es/ecommerce`);
  const panel = page.getByRole('tabpanel');
  await expect(
    panel.getByRole('link', { name: /Reservar una llamada sobre la app/ }),
  ).toHaveAttribute('href', /^https:\/\/calendar\.app\.google\//);
  await page.getByRole('tab', { name: 'WooCommerce' }).click();
  await expect(panel.getByRole('link', { name: /Ver cómo instalar el plugin/ })).toHaveAttribute(
    'href',
    /\/plugins\/woocommerce#install-until-it-is-listed$/,
  );
  await expect(
    panel.getByRole('link', { name: /Crear cuenta para obtener una clave/ }),
  ).toHaveAttribute('href', '/es/sign-up?next=%2Fconnectors');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('tab', { name: 'Otra plataforma' }).click();
  await panel.getByRole('link', { name: 'Probar la vista previa gratis' }).click();
  await page.waitForURL(`${base}/es#try`);
  await expect(page.locator('#try')).toBeVisible();
});
for (const colorScheme of ['light', 'dark'] as const) {
  test(`Spanish legal pages remain readable at 375px with ${colorScheme} preference`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await mkdir(output, { recursive: true });
    for (const [path, kind] of [
      ['/es/privacidad', 'privacy'],
      ['/es/terminos', 'terms'],
    ]) {
      await page.goto(`${base}${path}`);
      await expect(page.locator('main [lang="es"]')).toBeVisible();
      await expect(page.locator('main')).not.toContainText(
        'El texto legal que aparece a continuación está en inglés',
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: `${output}/legal-${kind}-${colorScheme}-375.png` });
    }
  });
}
