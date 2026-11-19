import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { HTML_LANG, LOCALES } from '../i18n/config';
import { ROUTES } from '../lib/seo/routes';
import de from '../messages/de.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
import es from '../messages/es.json' with { type: 'json' };
import fr from '../messages/fr.json' with { type: 'json' };
import it from '../messages/it.json' with { type: 'json' };
import pt from '../messages/pt.json' with { type: 'json' };

const base = process.env.LOCALIZED_E2E_URL || 'http://localhost:3127';
const messages = { en, es, de, fr, it, pt };
const routeTimeout = 15000;
test.setTimeout(45000);
test.skip(!process.env.LOCALIZED_E2E_URL, 'Requires an isolated local app');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local app only');

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
  );
});

for (const locale of LOCALES) {
  test(`${locale}: pricing, credits, registration and recovery stay in the same language`, async ({
    page,
  }) => {
    const t = messages[locale];
    const prefix = locale === 'en' ? '' : `/${locale}`;
    await page.goto(`${base}${ROUTES.pricing.paths[locale]}`);
    await expect(page.locator('html')).toHaveAttribute('lang', HTML_LANG[locale]);
    const buy = page.locator('#plans a[href^="/credits?plan=payg"]').first();
    await buy.click();
    await expect(page.locator('html')).toHaveAttribute('lang', HTML_LANG[locale]);
    await expect(page.getByRole('heading', { name: t.Credits.title, exact: true })).toBeVisible();
    await page.getByText(t.Credits.signUpToBuy, { exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/sign-up\\?next=`));
    await expect(page.getByRole('button', { name: t.Auth.createAccount, exact: true })).toBeVisible(
      { timeout: routeTimeout },
    );
    await expect(page.locator('html')).toHaveAttribute('lang', HTML_LANG[locale]);
    await page.goto(`${base}/forgot-password?locale=${locale}&next=%2Fr%2Fdemo-vase`);
    await expect(page.locator('html')).toHaveAttribute('lang', HTML_LANG[locale]);
    await expect(page.getByRole('link', { name: t.AuthService.signIn })).toHaveAttribute(
      'href',
      `${prefix}/sign-in?next=%2Fr%2Fdemo-vase`,
    );
  });
}

test('an active session can open the Spanish dashboard and change the product language', async ({
  page,
  context,
}) => {
  const response = await context.request.post(`${base}/api/auth/sign-up/email`, {
    headers: { origin: base },
    data: {
      email: `locale-${crypto.randomUUID()}@example.invalid`,
      name: 'Local fixture',
      password: 'local-test-password-123',
    },
  });
  expect(response.ok()).toBe(true);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${base}/es`);
  await page.getByRole('link', { name: es.Header.dashboard, exact: true }).first().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { name: es.AppHome.heading })).toBeVisible();
  await page.getByRole('button', { name: /Idioma/ }).click();
  await page.getByRole('menuitem', { name: 'Français' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { name: fr.AppHome.heading })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});

test('unconfirmed payment and canceled checkout never report success', async ({ page }) => {
  await page.goto(`${base}/credits?locale=es&status=success`);
  await expect(page.getByRole('alert')).toContainText(es.Credits.checkoutUnconfirmed);
  await page.goto(`${base}/credits?locale=es&status=canceled&next=%2Fviews`);
  await expect(page.getByRole('alert')).toContainText(es.Credits.checkoutCanceled);
  await expect(page.getByRole('link', { name: es.Credits.backToPhotos })).toHaveAttribute(
    'href',
    '/views',
  );
});

test('a confirmed fixture payment restores French and returns to the original project', async ({
  page,
  context,
}) => {
  const localDb = process.env.LOCALIZED_TEST_DATABASE_URL;
  test.skip(!localDb, 'Requires the isolated checkout fixture database');
  const signup = await context.request.post(`${base}/api/auth/sign-up/email`, {
    headers: { origin: base },
    data: {
      name: 'Local checkout fixture',
      email: `locale-payment-${crypto.randomUUID()}@example.invalid`,
      password: 'local-fixture-password-123',
    },
  });
  expect(signup.ok()).toBe(true);
  const account = (await signup.json()) as { user: { id: string } };
  const purchase = JSON.parse(
    execFileSync('bun', ['e2e/seed-purchase.ts', account.user.id], {
      env: { ...process.env, DATABASE_URL: localDb },
      encoding: 'utf8',
    }),
  ) as { sessionId: string };
  const params = new URLSearchParams({
    locale: 'fr',
    status: 'success',
    session_id: purchase.sessionId,
    next: '/r/demo-vase',
  });
  await page.goto(`${base}/credits?${params}`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('alert')).toContainText(
    fr.Credits.checkoutConfirmed.replace('{credits}', '500'),
  );
  await page.getByRole('link', { name: fr.Credits.backToProject }).click();
  await expect(page).toHaveURL(`${base}/r/demo-vase`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});
