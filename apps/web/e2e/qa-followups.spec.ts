import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { LOCALES } from '../i18n/config';
import { ROUTES } from '../lib/seo/routes';

const base = process.env.QA_BASE_URL || 'http://localhost:3177';
const output = process.env.EVIDENCE_DIR || '../../.data/qa-followups';
test.skip(!process.env.QA_BASE_URL, 'Requires an isolated local app without provider credentials');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local app only');

test.beforeEach(async ({ context }) => {
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
  );
});

test('auth and guides aliases return 308, preserve queries, and have real destinations', async ({
  request,
}) => {
  test.setTimeout(120_000);
  for (const locale of ['', ...LOCALES]) {
    const prefix = locale ? `/${locale}` : '';
    const target = locale === 'en' ? '' : prefix;
    for (const [alias, canonical] of [
      ['login', 'sign-in'],
      ['signup', 'sign-up'],
    ]) {
      const response = await request.get(`${base}${prefix}/${alias}?next=%2Flibrary`, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(`${target}/${canonical}?next=%2Flibrary`);
      expect((await request.get(`${base}${target}/${canonical}`)).status()).toBe(200);
    }
  }
  for (const locale of LOCALES) {
    const response = await request.get(`${base}/${locale}/learn`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(ROUTES.blog.paths[locale]);
    expect((await request.get(`${base}${ROUTES.blog.paths[locale]}`)).status()).toBe(200);
  }
  const article = await request.get(`${base}/es/learn/how-to-make-a-3d-model-from-photos`, {
    maxRedirects: 0,
  });
  expect(article.status()).toBe(308);
  expect(article.headers().location).toMatch(/^\/es\/guias\//);
  expect((await request.get(new URL(article.headers().location, base).href)).status()).toBe(200);
});

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [375, 1440]) {
    test(`model and sheet loading, loaded and error states: ${colorScheme}, ${width}px`, async ({
      playwright,
    }, testInfo) => {
      test.setTimeout(90_000);
      // Isolate viewport captures: Chromium can fail full-page captures after mobile.
      const browser = await playwright.chromium.launch();
      const page = await browser.newPage();
      await page.route('**/*', (route) =>
        new URL(route.request().url()).origin === base ? route.continue() : route.abort(),
      );
      try {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        let releaseModel = () => {};
        let releaseSheet = () => {};
        const modelGate = new Promise<void>((resolve) => {
          releaseModel = resolve;
        });
        const sheetGate = new Promise<void>((resolve) => {
          releaseSheet = resolve;
        });
        await page.route('**/showcase/vase.glb*', async (route) => {
          await modelGate;
          await route.continue();
        });
        await page.route('**/showcase/vase-angles.jpg', async (route) => {
          await sheetGate;
          await route.continue();
        });
        await page.goto(`${base}/r/demo-vase`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByText('Loading 3D model…', { exact: true })).toBeVisible();
        await expect(page.getByText('Loading angle sheet…', { exact: true })).toBeVisible();
        await mkdir(output, { recursive: true });
        const screenshot = `${output}/loading-${colorScheme}-${width}.png`;
        await page.screenshot({ path: screenshot, fullPage: true });
        await testInfo.attach('Loading model and angles', {
          path: screenshot,
          contentType: 'image/png',
        });
        releaseSheet();
        await expect(page.getByText('Loading angle sheet…', { exact: true })).toHaveCount(0);
        // Model completion follows the real custom element's load event; no synthetic event.
        releaseModel();
        await expect(page.locator('model-viewer')).toHaveJSProperty('loaded', true, {
          timeout: 45_000,
        });
        await expect(page.getByText('Loading 3D model…', { exact: true })).toHaveCount(0);
        await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        await page.screenshot({
          path: `${output}/loaded-${colorScheme}-${width}.png`,
          fullPage: true,
        });
        await page.unroute('**/showcase/vase.glb*');
        await page.unroute('**/showcase/vase-angles.jpg');
        await page.route('**/showcase/vase.glb*', (route) => route.abort());
        await page.route('**/showcase/vase-angles.jpg', (route) => route.abort());
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(
          page.getByRole('alert').filter({ hasText: '3D model could not load' }),
        ).toBeVisible();
        await expect(
          page.getByRole('alert').filter({ hasText: 'angle sheet could not load' }),
        ).toBeVisible();
        await page.screenshot({
          path: `${output}/error-${colorScheme}-${width}.png`,
          fullPage: true,
        });
      } finally {
        await browser.close();
      }
    });
  }
}

test('localized home metadata, nav and auth switch keep their language', async ({ page }) => {
  test.setTimeout(120_000);
  for (const locale of LOCALES) {
    await page.goto(`${base}${ROUTES.home.paths[locale]}`);
    await expect(page).toHaveTitle(/^Easy Render \| /);
    expect(await page.locator('meta[property="og:title"]').getAttribute('content')).toBe(
      await page.title(),
    );
    expect(await page.locator('meta[property="og:site_name"]').getAttribute('content')).toBe(
      'Easy Render',
    );
    const headerHub = page.locator('header nav a[href="/hub"]').first();
    if (locale !== 'en') {
      expect(await headerHub.textContent()).not.toBe('Hub');
      expect(await page.locator('footer a[href="/explore"]').textContent()).not.toBe('Gallery');
      expect(await page.locator('footer a[href="/connectors"]').textContent()).not.toBe('API keys');
    }
    const prefix = locale === 'en' ? '' : `/${locale}`;
    await page.goto(`${base}${prefix}/sign-in?next=%2Flibrary`);
    await expect(page.locator(`a[href="${prefix}/sign-up?next=%2Flibrary"]`)).toBeVisible();
  }
});

test('new uploads explicitly request private visibility', async ({ page }) => {
  let body = '';
  await page.route('**/api/renders', async (route) => {
    body = route.request().postData() ?? '';
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'QA: submission intercepted; no generation' }),
    });
  });
  await page.goto(`${base}/#try`);
  await page.locator('input[type="file"]').first().setInputFiles('public/showcase/vase.jpg');
  await page.getByRole('button', { name: 'Create free preview', exact: true }).click();
  await expect.poll(() => body).toContain('name="isPublic"\r\n\r\nfalse');
  await expect(page.getByText('QA: submission intercepted; no generation')).toBeVisible();
});
