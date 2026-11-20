import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  user: null as { id: string } | null,
  purchase: null as { issued_credits: number } | null,
}));

vi.mock('@easyrender/core', () => ({
  checkoutReturnPath: (value: string) => value ?? null,
  confirmedPurchase: async () => fixture.purchase,
  getBalance: async () => 500,
  getBillingStatus: async () => ({ plan: null, canManage: false }),
}));
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'es',
  getFormatter: async () => ({ number: (value: number) => String(value) }),
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/lib/actor', () => ({ currentUser: async () => fixture.user }));
vi.mock('@/lib/pricing', () => ({
  viewerPricing: async () => ({
    plans: { pro: { label: 'Pro', monthlyCredits: 5500, priceCents: 4900 } },
    creditPrice: 0.01,
    currency: 'eur',
    payg: { min: 500 },
  }),
  currentTopupPricing: async () => ({ priceCents: 1, creditsPerUnit: 1, currency: 'eur' }),
}));
vi.mock('@/components/buy-button', () => ({ BuyButton: () => null }));
vi.mock('@/components/payg-picker', () => ({ PaygPicker: () => null }));
vi.mock('@/components/pricing-exposure', () => ({ PricingExposure: () => null }));
vi.mock('@/components/purchase-conversion', () => ({ PurchaseConversion: () => null }));

import CreditsPage from '@/app/(dashboard)/(settings)/credits/page';

it('does not claim success from a URL without a confirmed purchase', async () => {
  const html = renderToStaticMarkup(
    await CreditsPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ status: 'success' }),
    }),
  );
  expect(html).not.toContain('>success<');
  expect(html).toContain('>checkoutUnconfirmed<');
});

it('distinguishes checkout in progress, paid, and canceled and keeps the project link', async () => {
  fixture.user = { id: 'buyer' };
  const params = { status: 'success', session_id: 'cs_test_fixture', next: '/r/example' };
  const render = async (searchParams: typeof params) =>
    renderToStaticMarkup(
      await CreditsPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve(searchParams),
      }),
    );
  expect(await render(params)).toContain('>checkoutPending<');
  fixture.purchase = { issued_credits: 500 };
  expect(await render(params)).toContain('>checkoutConfirmed<');
  const canceled = await render({ ...params, status: 'canceled' });
  expect(canceled).toContain('>checkoutCanceled<');
  expect(canceled).toContain('href="/r/example"');
});
