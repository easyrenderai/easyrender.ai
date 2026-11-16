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
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('header a').first().click();
  await page.waitForURL(`${base}/es`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('header')).toContainText(es.Header.nav.pricing);
  await expect(page.locator('#spec')).toContainText(es.Studio.tools.body);
  await expect(page.locator('#spec a')).toHaveText(es.Studio.tools.link);
  await page.locator('#spec a').click();
  await page.waitForURL(`${base}/hub`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('header')).toContainText(en.Header.nav.pricing);
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

test('monthly subscriber buys a top-up without changing Pro', async ({ page, context }) => {
  const signup = await context.request.post(`${base}/api/auth/sign-up/email`, {
    headers: { origin: base },
    data: {
      name: 'Pricing fixture',
      email: `simplify-${crypto.randomUUID()}@example.invalid`,
      password: 'local-fixture-password-123',
    },
  });
  expect(signup.ok()).toBe(true);
  await page.goto(`${base}/credits`);
  await expect(page.locator('html')).toHaveAttribute('data-pricing-variant', 'control');
  await page.getByRole('button', { name: 'Subscribe to Pro', exact: true }).click();
  await expect(
    page.getByText('You have 5,500 credits and you are on Pro.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Top up credits', { exact: true })).toBeVisible();
  await expect(page.getByText('Top-ups at your Pro rate', { exact: true })).toBeVisible();
  const preset = page.getByRole('button', { name: '1,000', exact: true });
  await preset.focus();
  await preset.press('Enter');
  await expect(preset).toHaveAttribute('aria-pressed', 'true');
  await expect(preset).toHaveAccessibleDescription('$8.91');
  await page.getByLabel('Or enter an amount').fill('499');
  await expect(page.getByRole('button', { name: 'Buy credits', exact: true })).toBeDisabled();
  await page.getByLabel('Or enter an amount').fill('1000');
  await expect(page.getByText('$8.91 for about 15 renders', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Buy 1,000 credits', exact: true }).click();
  await expect(
    page.getByText('You have 6,500 credits and you are on Pro.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Top-up credits never expire.', { exact: true })).toBeVisible();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: `${output}/subscriber-${colorScheme}-375.png`, fullPage: true });
  }
});

test('subscriber pricing pages show localized pack prices in every locale', async ({
  page,
  context,
}) => {
  const signup = await context.request.post(`${base}/api/auth/sign-up/email`, {
    headers: { origin: base },
    data: {
      name: 'Top-up fixture',
      email: `topup-${crypto.randomUUID()}@example.invalid`,
      password: 'local-fixture-password-123',
    },
  });
  expect(signup.ok()).toBe(true);
  await page.goto(`${base}/credits`);
  await page.getByRole('button', { name: 'Subscribe to Pro', exact: true }).click();
  await expect(
    page.getByText('You have 5,500 credits and you are on Pro.', { exact: true }),
  ).toBeVisible();
  for (const locale of LOCALES) {
    await page.goto(`${base}${ROUTES.pricing.paths[locale]}`);
    const copy = messages[locale];
    await expect(
      page.getByText(copy.PaygPicker.planRate.replace('{plan}', 'Pro'), { exact: true }),
    ).toBeVisible();
    const amount = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(
      8.91,
    );
    const credits = new Intl.NumberFormat(locale).format(1000);
    const preset = page.getByRole('button', { name: credits, exact: true });
    await expect(preset).toContainText(amount);
    await preset.click();
    await expect(
      page.getByText(copy.PaygPicker.estimate.replace('{price}', amount).replace('{count}', '15'), {
        exact: true,
      }),
    ).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (locale === 'en' || locale === 'es') {
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme });
        await page
          .locator('[aria-labelledby="pricing-topups"]')
          .screenshot({ path: `${output}/${locale}-topup-packs-${colorScheme}-375.png` });
      }
    }
  }
});
