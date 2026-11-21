import { readFile } from 'node:fs/promises';
import { displayPricing } from '@easyrender/harness/pricing';
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

  // 1. Upload on the try page: choosing the photo starts the free preview, still anonymous.
  await page.goto(`${app}/try`);
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'mug.png',
    mimeType: 'image/png',
    buffer: productPhoto(),
  });
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
  // `next dev` paints the page before it is interactive and the render view re-renders while it
  // polls, so a click can be lost: click until the sign-up page opens.
  await expect(async () => {
    await page.getByRole('link', { name: 'Create free account' }).click({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/sign-up\?next=/, { timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
  await page.getByLabel('Email').fill(`paid-flow-${crypto.randomUUID()}@example.invalid`);
  await page.getByLabel('Password').fill('paid-flow-password-123');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.waitForURL(`${app}/r/${renderId}`, { timeout: 60_000 });
  expect(await balanceOf(page)).toBe(0);

  // 4. No credits yet: the build button is a link to buy them.
  await page.getByRole('link', { name: 'Buy credits to create the 3D model' }).click();
  await expect(page).toHaveURL(/\/credits\?next=/);
  // `next dev` paints the picker before it is interactive. Pick the pack until the page shows it
  // selected, so the one purchase below is the pack this test chose and not the default.
  const pack = displayPricing('control', 'usd').payg.presets.at(-1) as number;
  const packText = new Intl.NumberFormat('en-US').format(pack);
  const preset = page.getByRole('button', { name: packText, exact: true });
  await expect(async () => {
    await preset.click();
    await expect(preset).toHaveAttribute('aria-pressed', 'true', { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  // The dev checkout grants the credits and redirects back to the credits page, as Stripe would.
  // This page is already /credits, so wait for that redirect itself and not for a matching URL.
  const returned = page.waitForResponse(
    (response) => response.request().redirectedFrom()?.url().includes('/api/dev/checkout') === true,
    { timeout: 60_000 },
  );
  await page.getByRole('button', { name: `Buy ${packText} credits`, exact: true }).click();
  await returned;
  await page.waitForLoadState('load');
  await expect.poll(() => balanceOf(page), { timeout: 15_000 }).toBe(pack);
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
