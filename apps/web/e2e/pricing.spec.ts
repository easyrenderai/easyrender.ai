import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// Local-only fixture: an enabled, property-free 100% rollout with control/test at 50/50.
// Start the app with PRICING_AB_ENABLED=1, a local flag endpoint and a scratch database.
const base = process.env.PRICING_E2E_URL || 'http://localhost:3147';
const output = process.env.EVIDENCE_DIR || '../../.data/pricing-evidence';
test.skip(process.env.PRICING_AB_E2E !== '1', 'Requires the isolated pricing fixture');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local app only');
const seed = (variant: 'control' | 'test') => {
  for (let i = 0; i < 1000; i++) {
    const id = `pricing-qa-${i}`;
    const bucket =
      Number.parseInt(
        createHash('sha1').update(`pricing-test-2026-11.${id}variant`).digest('hex').slice(0, 15),
        16,
      ) / Number('0xfffffffffffffff');
    if ((bucket < 0.5 ? 'control' : 'test') === variant) return id;
  }
  throw new Error('No seed');
};
for (const variant of ['control', 'test'] as const) {
  test(`${variant}: declined analytics, six locales, signup, server validation and credit grant`, async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await mkdir(output, { recursive: true });
    const analytics: string[] = [];
    page.on('request', (request) => {
      if (/posthog\.com|google-analytics\.com|googletagmanager\.com|:55440/.test(request.url()))
        analytics.push(request.url());
    });
    await context.addCookies([
      { name: 'er_anon', value: seed(variant), url: base, httpOnly: true, sameSite: 'Lax' },
      {
        name: 'er_consent',
        value: encodeURIComponent(
          JSON.stringify({ version: 'v1', date: new Date().toISOString(), accepted: false }),
        ),
        url: base,
      },
      { name: 'er_home_locale', value: 'en', url: base },
    ]);
    const model = variant === 'test' ? '1.28' : '0.64';
    const firstPlan = variant === 'test' ? '$79' : '$49';
    await page.goto(`${base}/credits?__geo=DE`);
    await expect(page.locator('html')).toHaveAttribute('data-pricing-variant', variant);
    await expect(page.getByRole('heading', { name: 'Credits', exact: true })).toBeVisible();
    await expect(
      page.getByText(new RegExp(`full 3D render.*${model.replace('.', '\\.')}`)),
    ).toBeVisible();
    await expect(page.getByText(firstPlan, { exact: true })).toBeVisible();
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width: 375, height: 812 });
      await page.screenshot({
        path: `${output}/${variant}-${colorScheme}-375.png`,
        fullPage: true,
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: `${output}/${variant}-desktop.png`, fullPage: true });
    for (const locale of ['en', 'es', 'de', 'fr', 'it', 'pt']) {
      await page.goto(`${base}/${locale === 'en' ? '' : locale}?__geo=DE`);
      await expect(page.locator('#pricing')).toContainText(
        model.replace('.', locale === 'en' ? '.' : ','),
      );
      const offers = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(offers.join('')).toContain(variant === 'test' ? '79.00' : '49.00');
      const faq = page.locator('#faq');
      await expect(faq).toContainText(model.replace('.', locale === 'en' ? '.' : ','));
    }
    expect(analytics).toEqual([]);
    const signup = await context.request.post(`${base}/api/auth/sign-up/email`, {
      headers: { origin: base },
      data: {
        name: 'Pricing QA',
        email: `pricing-${crypto.randomUUID()}@example.invalid`,
        password: 'local-pricing-password-123',
      },
    });
    expect(signup.ok()).toBe(true);
    await page.goto(`${base}/credits?__geo=DE`);
    await expect(page.locator('html')).toHaveAttribute('data-pricing-variant', variant);
    await context.addCookies([
      {
        name: 'er_anon',
        value: seed(variant === 'test' ? 'control' : 'test'),
        url: base,
        httpOnly: true,
      },
    ]);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-pricing-variant', variant);
    const stale = await context.request.post(`${base}/api/checkout`, {
      headers: { 'x-pricing-variant': variant === 'test' ? 'control' : 'test' },
      data: { plan: 'payg', credits: 500 },
    });
    expect(stale.status()).toBe(409);
    const invalid = await context.request.post(`${base}/api/checkout`, {
      data: { plan: 'payg', credits: 499, price: 1, pricing_variant: 'control' },
    });
    expect(invalid.status()).toBe(400);
    await page.getByRole('button', { name: '1,000', exact: true }).click();
    await expect(page.getByRole('button', { name: '1,000', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page.getByText(
        variant === 'test' ? '$20.00 for about 15 renders' : '$10.00 for about 15 renders',
        { exact: true },
      ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Subscribe to Pro', exact: true }).click();
    await expect(
      page.getByText(new RegExp(`You have ${variant === 'test' ? '4,500' : '5,500'} credits`)),
    ).toBeVisible();
    expect(analytics).toEqual([]);
  });
}
