import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { APP_ORIGIN } from './paid-flow/endpoints';

test('inline model feedback: keyboard, errors, persistence, ownership and narrow layouts', async ({
  page,
  context,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const signup = await context.request.post(`${APP_ORIGIN}/api/auth/sign-up/email`, {
    headers: { origin: APP_ORIGIN },
    data: {
      name: 'Feedback walk',
      email: `feedback-${crypto.randomUUID()}@example.invalid`,
      password: 'feedback-fixture-password',
    },
  });
  expect(signup.ok()).toBe(true);
  const { user } = (await signup.json()) as { user: { id: string } };
  const ids = JSON.parse(
    execFileSync('bun', ['e2e/seed-feedback.ts', user.id], { encoding: 'utf8', env: process.env }),
  ) as string[];
  const [lowId, highId, dismissedId, pendingId] = ids;
  // The application, database and local storage are real; the model is a seeded showcase fixture.
  await page.goto(`${APP_ORIGIN}/r/${lowId}`);
  const prompt = page.getByRole('heading', { name: 'How did your 3D model turn out?' });
  await expect(prompt).toBeVisible({ timeout: 45_000 });
  const first = page.getByRole('radio', { name: '1 out of 5 stars' });
  // The viewer mounts from a client effect; wait for hydration before sending keyboard events.
  await expect(page.locator('model-viewer')).toBeVisible({ timeout: 30_000 });
  await first.focus();
  await expect(first).toBeFocused();
  await page.keyboard.press('Space');
  await expect(first).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: '2 out of 5 stars' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('radio', { name: '2 out of 5 stars' })).toBeChecked();
  await page.getByRole('button', { name: 'Shape', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Shape', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('Comment (optional)').fill('Missing handle');

  for (const width of [375, 1440]) {
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      // The responsive app shell remounts its page at the mobile breakpoint.
      await page.getByRole('radio', { name: '2 out of 5 stars' }).click();
      await page.getByLabel('Comment (optional)').fill('Missing handle');
      const shape = page.getByRole('button', { name: 'Shape', exact: true });
      if ((await shape.getAttribute('aria-pressed')) !== 'true') await shape.click();
      const card = page.locator('.model-feedback-enter');
      expect(await card.evaluate((element) => getComputedStyle(element).animationName)).toBe(
        'none',
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const file = testInfo.outputPath(`feedback-${width}-${colorScheme}.png`);
      await page.screenshot({ path: file });
      await testInfo.attach(`feedback-${width}-${colorScheme}`, {
        path: file,
        contentType: 'image/png',
      });
    }
  }
  const feedbackPath = `**/api/renders/${lowId}/feedback`;
  await page.route(feedbackPath, (route) =>
    route.fulfill({ status: 500, json: { code: 'feedback_unavailable' } }),
  );
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Could not save' })).toBeVisible();
  await expect(page.getByLabel('Comment (optional)')).toHaveValue('Missing handle');
  await page.unroute(feedbackPath);
  const saved = page.waitForResponse(
    (response) => response.url().endsWith(`/${lowId}/feedback`) && response.status() === 201,
  );
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await saved;
  await expect(page.getByText('Thanks for your feedback!', { exact: true })).toBeVisible();
  await expect(page.getByText('Thanks for your feedback!', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Comment (optional)')).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 1000 });
  await expect(prompt).toHaveCount(0);
  expect(
    (
      await context.request.post(`${APP_ORIGIN}/api/renders/${lowId}/feedback`, {
        data: { rating: 5 },
      })
    ).status(),
  ).toBe(409);
  await page.reload();
  await expect(prompt).toHaveCount(0);

  await page.goto(`${APP_ORIGIN}/r/${highId}`);
  await page.getByRole('radio', { name: '5 out of 5 stars' }).click();
  await expect(page.getByText('What went wrong? (optional)')).toHaveCount(0);
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByText('Thanks for your feedback!', { exact: true })).toBeVisible();

  await page.goto(`${APP_ORIGIN}/r/${dismissedId}`);
  await page.getByRole('button', { name: 'Close feedback' }).click();
  await expect(prompt).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(prompt).toHaveCount(0);
  await page.reload();
  await expect(prompt).toHaveCount(0);

  await page.goto(`${APP_ORIGIN}/r/${pendingId}`);
  await expect(prompt).toHaveCount(0);

  const visitor = await browser.newContext();
  const publicPage = await visitor.newPage();
  await publicPage.goto(`${APP_ORIGIN}/r/${highId}`);
  await expect(
    publicPage.getByRole('heading', { name: 'How did your 3D model turn out?' }),
  ).toHaveCount(0);
  expect(
    (
      await visitor.request.post(`${APP_ORIGIN}/api/renders/${highId}/feedback`, {
        data: { rating: 5 },
      })
    ).status(),
  ).toBe(401);
  await visitor.close();
});
