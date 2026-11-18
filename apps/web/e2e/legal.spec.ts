import { expect, test } from '@playwright/test';
import { HTML_LANG, LOCALES } from '../i18n/config';
import { ROUTES } from '../lib/seo/routes';
import { base, routeLocalApp } from './local-browser';

for (const locale of LOCALES) {
  for (const kind of ['privacy', 'terms'] as const) {
    test(`${locale} ${kind} is public, linked and has canonical metadata`, async ({ page }) => {
      await routeLocalApp(page.context());
      const path = ROUTES[kind].paths[locale];
      const response = await page.goto(`${base}${path}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', HTML_LANG[locale]);
      await expect(page.locator('main h1')).toBeVisible();
      for (const detail of [
        'MRRAMOS INMUEBLES SL',
        'CIF/NIF: B75763383',
        'C/ San Miguel 13, Bajo 4, 11001 Cádiz',
        'info@easyrender.ai',
      ]) {
        await expect(page.locator('main')).toContainText(detail);
      }
      await expect(page.locator('main')).not.toContainText('Smithii');
      await expect(page.locator('main')).not.toContainText(/\[[A-Z][A-Z _/-]*\]/);
      if (kind === 'privacy') {
        for (const detail of [
          'LOPDGDD',
          locale === 'es' ? 'RGPD de la UE' : 'EU GDPR',
          'UK GDPR',
        ]) {
          await expect(page.locator('main')).toContainText(detail);
        }
        await expect(page.locator('#legal-transfers + p')).toContainText(
          'UK International Data Transfer Agreement',
        );
        await expect(page.locator('#legal-rights + p')).toContainText(
          'Agencia Española de Protección de Datos (AEPD)',
        );
        await expect(page.locator('#legal-rights + p')).not.toContainText(
          'Information Commissioner',
        );
      } else {
        await expect(page.locator('main')).toContainText(
          locale === 'es'
            ? 'Easy Render es un producto operado por MRRAMOS INMUEBLES SL'
            : 'Easy Render is a product operated by MRRAMOS INMUEBLES SL',
        );
        const law = page.locator('#legal-law + p');
        await expect(law).toContainText(locale === 'es' ? 'Derecho español' : 'Spanish law');
        await expect(law).toContainText(
          locale === 'es'
            ? 'tribunales de España tienen competencia'
            : 'courts of Spain have jurisdiction',
        );
        await expect(law).toContainText(
          locale === 'es' ? 'protecciones imperativas' : 'mandatory protections',
        );
        await expect(law).not.toContainText('UAE federal law');
        await expect(law).not.toContainText('Ras Al Khaimah');
      }
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${base}${path}`);
      await expect(page.locator('link[hreflang="pt-PT"]')).toHaveAttribute(
        'href',
        `${base}${ROUTES[kind].paths.pt}`,
      );
      await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute(
        'href',
        `${base}${ROUTES[kind].paths.en}`,
      );
      for (const linked of ['privacy', 'terms', 'cookies'] as const) {
        await expect(
          page.locator(`footer a[href="${ROUTES[linked].paths[locale]}"]`),
        ).toBeVisible();
      }
      const legalBody = page.locator(`main [lang="${locale === 'es' ? 'es' : 'en'}"]`);
      if (kind === 'privacy') await expect(legalBody).toContainText('PostHog');
      await expect(legalBody.locator('#legal-public + p')).toContainText(
        locale === 'es' ? 'privados por defecto' : 'private by default',
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  }
}

test('sign-up shows legal links before submitting an account', async ({ page }) => {
  await routeLocalApp(page.context());
  await page.goto(`${base}/sign-up`);
  await expect(page.locator('main a[href="/privacy"]')).toBeVisible();
  await expect(page.locator('main a[href="/terms"]')).toBeVisible();
});
