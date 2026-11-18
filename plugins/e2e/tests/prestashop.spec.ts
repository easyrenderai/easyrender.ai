import { expect, test } from '@playwright/test';
import { API_KEY, apiRequests, describePage, isImageLoaded, resetApi, shot } from './helpers';

const VERSION = process.env.PS_TAG ?? '8.1';

test.describe(`PrestaShop module on a real shop (${VERSION})`, () => {
  test.beforeAll(resetApi);

  test('connect, price, generate the catalogue, show the button and QR', async ({ page }) => {
    // Sign in to the back office.
    await page.goto('/admin/index.php?controller=AdminLogin');
    await page.fill('#email', 'admin@example.com');
    await page.fill('#passwd', 'Password123!');
    await page.click('#submit_login');
    await page.waitForLoadState('networkidle');
    console.log(`After login:\n${await describePage(page)}`);

    // The module's Configure page. PrestaShop asks before opening a legacy page without its token.
    // The back office folder is renamed by the installer on some versions, so take it from where login landed.
    const adminBase = new URL(page.url()).pathname.match(/^(.*?)\/index\.php/)?.[1] ?? '/admin';
    await page.goto(`${adminBase}/index.php?controller=AdminModules&configure=easyrender3d`);
    const risks = page.getByRole('link', { name: /understand the risks/i });
    if (await risks.isVisible().catch(() => false)) await risks.click();
    try {
      await expect(page.locator('#EASYRENDER3D_API_KEY')).toBeVisible({ timeout: 15_000 });
    } catch (error) {
      console.log(`Configure page did not show the key field:\n${await describePage(page)}`);
      throw error;
    }
    await shot(page, `prestashop-${VERSION}-1-settings`);

    await page.fill('#EASYRENDER3D_API_KEY', API_KEY);
    await page.locator('button[name="submitEasyrender3dKey"]').click();

    // Saved: the button states the count and the price before anything is charged.
    const generate = page.locator('#easyrender-generate');
    try {
      await expect(generate).toHaveText(/Generate 3D for \d+ products \(\d+ credits\)/);
    } catch (error) {
      const probe = await page.evaluate(async () => {
        const cfg = (window as unknown as { easyrenderAdmin?: { ajaxUrl: string } })
          .easyrenderAdmin;
        if (!cfg) return 'no easyrenderAdmin config on the page';
        const url = `${cfg.ajaxUrl}${cfg.ajaxUrl.includes('?') ? '&' : '?'}ajax=1`;
        const response = await fetch(url, {
          method: 'POST',
          body: new URLSearchParams({ step: 'prepare' }),
          credentials: 'same-origin',
        });
        return `${url}\n${response.status} ${(await response.text()).slice(0, 1500)}`;
      });
      const scripts = await page.evaluate(() =>
        Array.from(document.scripts)
          .map((el) => `${el.src} ${el.defer ? 'defer' : ''}`)
          .filter((src) => src.includes('easyrender')),
      );
      console.log(`module scripts on the page: ${JSON.stringify(scripts)}`);
      const detail = await page.locator('#easyrender-detail').textContent();
      console.log(`Generate button never left "checking".\nDETAIL: ${detail}\nPROBE: ${probe}`);
      throw error;
    }
    const label = (await generate.textContent()) ?? '';
    const [, count, credits] = label.match(/for (\d+) products \((\d+) credits\)/) ?? [];
    const products = Number(count);
    expect(products).toBeGreaterThan(0);
    expect(Number(credits)).toBe(products * 64);
    await shot(page, `prestashop-${VERSION}-2-price-before-click`);

    // Saving the form again without touching the key must keep the key.
    await page.locator('button[name="submitEasyrender3dKey"]').click();
    await expect(generate).toHaveText(/Generate 3D for \d+ products/);

    // One click.
    await generate.click();
    await expect(page.locator('#easyrender-status')).toContainText(
      `${products} ready, 0 in progress, 0 waiting`,
      {
        timeout: 120_000,
      },
    );
    await shot(page, `prestashop-${VERSION}-3-after-generate`);

    // What the API received.
    const posts = (await apiRequests()).filter((request) => request.method === 'POST');
    expect(posts).toHaveLength(Math.ceil(products / 100));
    expect(posts[0].platform).toBe('prestashop');
    expect(posts[0].store).toContain('localhost');
    const sent = posts.flatMap(
      (post) => post.items as Array<{ externalId: string; imageUrl: string }>,
    );
    expect(sent).toHaveLength(products);
    for (const item of sent) expect(item.imageUrl).toMatch(/^https:\/\/localhost:8080\//);
    expect(posts.reduce((sum, post) => sum + (post.maxCredits ?? 0), 0)).toBe(products * 64);

    // The background-sync URL answers with the right token and refuses a wrong one.
    const cron = ((await page.locator('code').first().textContent()) ?? '').trim();
    expect(cron).toMatch(/controller=cron|module\/easyrender3d\/cron/);
    const ok = await page.request.get(cron);
    expect(ok.status()).toBe(200);
    expect(await ok.text()).toMatch(/^ok \d+ ready/);
    const denied = await page.request.get(cron.replace(/token=[^&]+/, 'token=wrong'));
    expect(denied.status()).toBe(403);
  });

  test('the product page shows "View in your room" and a working QR code', async ({ page }) => {
    await page.goto('/index.php?id_product=1&controller=product');
    const button = page.locator('.easyrender-ar__button');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('View in your room');
    await expect(button).toHaveAttribute('href', /^http:\/\/api\.test:4010\/ar\/r_[0-9a-f]+$/);

    const qr = page.locator('.easyrender-ar__qr img');
    await expect(qr).toBeVisible();
    await expect(qr).toHaveAttribute(
      'src',
      /^http:\/\/api\.test:4010\/api\/renders\/r_[0-9a-f]+\/qr$/,
    );
    await expect.poll(() => isImageLoaded(page, '.easyrender-ar__qr img')).toBe(true);

    await page.locator('.easyrender-ar').scrollIntoViewIfNeeded();
    await shot(page, `prestashop-${VERSION}-4-product-page`);
    await page
      .locator('.easyrender-ar')
      .screenshot({ path: `screenshots/prestashop-${VERSION}-5-button-and-qr.png` });

    // The button opens the AR page.
    const href = (await button.getAttribute('href')) as string;
    const popup = page.waitForEvent('popup');
    await button.click();
    const ar = await popup;
    await expect(ar).toHaveURL(href);
    await expect(ar.locator('h1')).toHaveText('View in your room');
  });
});
