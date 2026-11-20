import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { HTML_LANG, LOCALES } from '../i18n/config';
import { ROUTES } from '../lib/seo/routes';
import de from '../messages/de.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
import es from '../messages/es.json' with { type: 'json' };
import fr from '../messages/fr.json' with { type: 'json' };
import it from '../messages/it.json' with { type: 'json' };
import pt from '../messages/pt.json' with { type: 'json' };

// Run only against an isolated local app with Stripe absent, pricing control and a scratch DB.
const base = process.env.PRICING_E2E_URL || 'http://localhost:3159';
const output = process.env.EVIDENCE_DIR || '../../.data/pricing-simplify';
const messages = { en, es, de, fr, it, pt };
test.skip(!process.env.PRICING_E2E_URL, 'Requires the isolated local pricing app');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local app only');

test.beforeEach(async ({ context }) => {
  // Never follow external links, load analytics, or contact a rendering/payment provider.
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === new URL(base).origin
      ? route.continue()
      : route.abort(),
  );
});

test('home redirect refreshes nav and every section to the same locale', async ({
  page,
  context,
}) => {
  await context.addCookies([{ name: 'er_home_locale', value: 'es', url: base }]);
  await page.goto(`${base}/hub`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.locator('header a').first().click();
  await page.waitForURL(`${base}/es`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('header')).toContainText(es.Header.nav.pricing);
  await expect(page.locator('#spec')).toContainText(es.Studio.tools.body);
  await expect(page.locator('#spec a')).toHaveText(es.Studio.tools.link);
  await page.locator('#spec a').click();
  await page.waitForURL(`${base}/hub`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('header')).toContainText(es.Header.nav.pricing);
});

for (const locale of LOCALES) {
  test(`${locale}: exactly three options, free preview CTA and localized creations section`, async ({
    page,
    context,
  }) => {
    await context.addCookies([{ name: 'er_home_locale', value: locale, url: base }]);
    const copy = messages[locale];
    await page.goto(`${base}${ROUTES.pricing.paths[locale]}`);
    await expect(page.locator('html')).toHaveAttribute('lang', HTML_LANG[locale]);
    await expect(page.locator('#plans [data-slot="card-title"]')).toHaveText([
      copy.Landing.pricing.payg.name,
      'Pro',
      copy.Landing.pricing.enterprise.name,
    ]);
    const cta = page.getByRole('link', { name: copy.Landing.pricing.tryFree, exact: true });
    await expect(cta).toHaveAttribute('href', `${ROUTES.home.paths[locale]}#try`);
    await cta.click();
    await expect(page.locator('#try')).toBeVisible();
    await expect(page.locator('#spec')).toContainText(copy.Studio.tools.lead);
    await expect(page.locator('#spec')).toContainText(copy.Studio.tools.body);
    await expect(page.locator('#spec a')).toHaveText(copy.Studio.tools.link);
    await expect(page.locator('#spec a')).toHaveAttribute('href', '/hub');
    if (locale === 'en' || locale === 'es') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.locator('#spec .sec__head').scrollIntoViewIfNeeded();
      await mkdir(output, { recursive: true });
      await page
        .locator('#spec .sec__head')
        .screenshot({ path: `${output}/${locale}-creations.png` });
    }
    await expect(page.locator('#pricing [data-slot="card-title"]')).toHaveText([
      copy.Landing.pricing.payg.name,
      'Pro',
      copy.Landing.pricing.enterprise.name,
    ]);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`${base}${ROUTES.pricing.paths[locale]}`);
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/${locale}-${colorScheme}-375.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    if (locale === 'en' || locale === 'es') {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({ path: `${output}/${locale}-desktop.png`, fullPage: true });
    }
  });
}
