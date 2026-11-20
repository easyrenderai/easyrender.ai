import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { APP_ORIGIN, MOCK_ORIGIN } from './endpoints';
import { productPhoto } from './png';
import type { MockRequest } from './replicate-mock';

// One visitor walks the whole paid journey against the real app: upload a photo, see the free
// preview, sign up, buy credits through the dev checkout, build the 3D model and download it.
// Only Replicate is a stand-in (see replicate-mock.ts); the database, auth, credits ledger,
// storage and polling are the real code paths.
const app = APP_ORIGIN;
const mock = MOCK_ORIGIN;

const GLB_MAGIC = 'glTF';

async function mockRequests(): Promise<MockRequest[]> {
  return (await fetch(`${mock}/__requests`)).json();
}

async function balanceOf(page: Page): Promise<number> {
  const response = await page.request.get(`${app}/api/renders`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { balance: number }).balance;
}

test('a visitor signs up, previews, pays, builds and downloads a 3D model', async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await fetch(`${mock}/__reset`);

  // 1. Upload on the home page and start the free preview, still anonymous.
  await page.goto(app);
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'mug.png',
    mimeType: 'image/png',
    buffer: productPhoto(),
  });
  await page.getByRole('button', { name: 'Create free preview' }).click();
  await page.waitForURL(/\/r\/[a-z0-9]+/i, { timeout: 60_000 });
  const renderId = new URL(page.url()).pathname.split('/').pop() as string;

  // 2. The preview (the angle sheet) arrives from the provider through the app's polling.
  await expect(page.getByText('Preview ready').first()).toBeVisible({ timeout: 90_000 });
  const preview = await page.request.get(`${app}/api/renders/${renderId}/preview`);
  expect(preview.status()).toBe(200);
  expect(preview.headers()['content-type']).toContain('image/');
  let seen = await mockRequests();
  expect(seen.filter((request) => request.method === 'POST')).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath('1-preview.png') });

  // 3. Building needs an account: sign up and come back to the same preview.
  await page.getByRole('link', { name: 'Create an account to continue' }).click();
  await expect(page).toHaveURL(/\/sign-up\?next=/);
  await page.getByLabel('Email').fill(`paid-flow-${crypto.randomUUID()}@example.invalid`);
  await page.getByLabel('Password').fill('paid-flow-password-123');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL(`${app}/r/${renderId}`, { timeout: 60_000 });
  expect(await balanceOf(page)).toBe(0);

  // 4. No credits yet: the build button is a link to buy them.
  await page.getByRole('link', { name: 'Buy credits to create the 3D model' }).click();
  await expect(page).toHaveURL(/\/credits\?next=/);
  const presets = page.getByRole('button', { pressed: false }).filter({ hasText: /\d/ });
  await presets.last().click();
  await page.getByRole('button', { name: /^Buy [\d,.]+ credits$/ }).click();
  // The dev checkout grants the credits and returns to the credits page, as Stripe would.
  await page.waitForURL(/\/credits(\?|$)/, { timeout: 30_000 });
  await expect.poll(() => balanceOf(page), { timeout: 15_000 }).toBeGreaterThan(0);
  const funded = await balanceOf(page);

  // 5. Back on the preview the build button states its price. Press it.
  await page.goto(`${app}/r/${renderId}`);
  const build = page.getByRole('button', { name: /^Create 3D model · [\d,.]+ credits$/ });
  await expect(build).toBeVisible({ timeout: 30_000 });
  await build.click();
  await expect(page.getByText('Building 3D model').first()).toBeVisible({ timeout: 30_000 });

  // 6. The model arrives and the owner can download it.
  const download = page.getByRole('link', { name: 'Download GLB' });
  await expect(download).toBeVisible({ timeout: 120_000 });
  const [saved] = await Promise.all([page.waitForEvent('download'), download.click()]);
  const file = testInfo.outputPath('model.glb');
  await saved.saveAs(file);
  const bytes = await readFile(file);
  expect(bytes.subarray(0, 4).toString('ascii')).toBe(GLB_MAGIC);
  expect(bytes.length).toBeGreaterThan(20_000);
  await page.screenshot({ path: testInfo.outputPath('2-ready.png') });

  // 7. What was charged and what was sent to the provider.
  const view = (await (await page.request.get(`${app}/api/renders/${renderId}`)).json()) as {
    status: string;
    hasModel: boolean;
    credits: number;
    renderCredits: number;
  };
  expect(view).toMatchObject({ status: 'ready', hasModel: true });
  expect(view.credits).toBe(view.renderCredits);
  expect(await balanceOf(page)).toBe(funded - view.renderCredits);
  seen = await mockRequests();
  const started = seen.filter((request) => request.method === 'POST');
  // One sheet for the preview, one build, and the build got the photo plus the nine sheet views.
  expect(started.map((request) => request.kind)).toEqual(['sheet', 'build']);
  expect(started[1]?.imageCount).toBe(10);
});
