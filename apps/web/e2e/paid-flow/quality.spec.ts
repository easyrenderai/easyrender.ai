import { execFileSync } from 'node:child_process';
import { BUILD_QUALITY_CREDITS, RENDER_CREDITS } from '@easyrender/harness/pricing';
import { expect, test } from '@playwright/test';
import { APP_ORIGIN, MOCK_ORIGIN } from './endpoints';
import { productPhoto } from './png';
import type { MockRequest } from './replicate-mock';

// A signed-in owner picks High in the build panel, pays that price, and then rebuilds the model in
// Standard for free: the credit difference comes back once. Replicate is the mock; the database,
// auth, credits ledger and polling are the real code (see paid-flow.spec.ts).
const app = APP_ORIGIN;
const mock = MOCK_ORIGIN;
const HIGH = BUILD_QUALITY_CREDITS.high;

type View = {
  status: string;
  credits: number;
  buildQuality: string;
  rebuildRefundCredits: number;
};

test('an owner builds at High quality and rebuilds in Standard for the difference', async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  const databaseUrl = process.env.DATABASE_URL;
  test.skip(!databaseUrl, 'Requires the scratch database');
  await fetch(`${mock}/__reset`);

  // An account with credits (the signed fixture payment, as the localized funnel test does).
  const signup = await context.request.post(`${app}/api/auth/sign-up/email`, {
    headers: { origin: app },
    data: {
      name: 'Quality walk',
      email: `quality-${crypto.randomUUID()}@example.invalid`,
      password: 'quality-walk-password-123',
    },
  });
  expect(signup.ok()).toBe(true);
  const account = (await signup.json()) as { user: { id: string } };
  execFileSync('bun', ['e2e/seed-purchase.ts', account.user.id], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
  });
  const balance = async () =>
    ((await (await context.request.get(`${app}/api/renders`)).json()) as { balance: number })
      .balance;
  const funded = await balance();
  expect(funded).toBeGreaterThanOrEqual(HIGH);

  // A finished preview.
  const created = await context.request.post(`${app}/api/renders`, {
    multipart: { image: { name: 'mug.png', mimeType: 'image/png', buffer: productPhoto() } },
  });
  expect(created.ok()).toBe(true);
  const { id } = (await created.json()) as { id: string };
  const read = async () =>
    (await (await context.request.get(`${app}/api/renders/${id}`)).json()) as View;
  await expect.poll(async () => (await read()).status, { timeout: 90_000 }).toBe('preview_ready');

  // The build panel: High is one click, and the button states its price before it is pressed.
  await page.goto(`${app}/r/${id}`);
  await page.getByRole('radio', { name: /High/ }).click();
  const build = page.getByRole('button', { name: `Create 3D model · ${HIGH} credits` });
  await expect(build).toBeVisible({ timeout: 30_000 });
  await build.click();
  const download = page.getByRole('link', { name: 'Download GLB' });
  await expect(download).toBeVisible({ timeout: 120_000 });
  expect(await read()).toMatchObject({ status: 'ready', buildQuality: 'high', credits: HIGH });
  expect(await balance()).toBe(funded - HIGH);
  // The model name is never shown to the buyer.
  await expect(page.getByText(/trellis/i)).toHaveCount(0);

  // Rebuild in Standard: free, and the difference is returned once.
  const refund = HIGH - RENDER_CREDITS;
  const rebuild = page.getByRole('button', { name: `Rebuild in Standard, ${refund} credits back` });
  await rebuild.click();
  await expect(download).toBeHidden({ timeout: 30_000 });
  await expect(download).toBeVisible({ timeout: 120_000 });
  expect(await read()).toMatchObject({
    status: 'ready',
    buildQuality: 'low',
    credits: RENDER_CREDITS,
  });
  expect(await balance()).toBe(funded - RENDER_CREDITS);
  await expect(rebuild).toBeHidden();

  // One High build from the photo alone, then one standard build on the photo and nine views.
  const builds = ((await (await fetch(`${mock}/__requests`)).json()) as MockRequest[]).filter(
    (request) => request.method === 'POST' && request.kind === 'build',
  );
  expect(builds.map((request) => request.imageCount)).toEqual([1, 10]);
});
