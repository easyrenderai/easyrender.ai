import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  report: vi.fn(),
  revoke: vi.fn(),
  checkout: vi.fn(async () => ({
    sessionId: 'session-fixture',
    url: 'https://checkout.invalid',
    analytics: {},
  })),
}));
vi.mock('@easyrender/core', async (original) => ({
  ...(await original<typeof import('@easyrender/core')>()),
  createCheckoutDetails: mocks.checkout,
  isGoogleMeasurementConfigured: () => true,
  reportError: mocks.report,
}));
vi.mock('@easyrender/db', () => ({
  db: () => ({ googleCheckout: { create: mocks.create, updateMany: mocks.revoke } }),
}));
vi.mock('@/lib/actor', () => ({
  resolveActor: async () => ({ userId: 'owner', anonId: null, geoCountry: 'ES' }),
}));

import { POST as revoke } from '@/app/api/analytics/revoke/route';
import { POST } from '@/app/api/checkout/route';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GA_MEASUREMENT_ID', 'G-TEST');
});
it.each([false, true])(
  'records advertising only from explicit server-checked consent: %s',
  async (advertising) => {
    const cookie = encodeURIComponent(
      JSON.stringify({
        version: 'v1',
        date: new Date().toISOString(),
        accepted: true,
        advertising,
      }),
    );
    const response = await POST(
      new Request('https://easyrender.ai/api/checkout', {
        method: 'POST',
        headers: { 'x-vercel-ip-country': 'ES', cookie: `er_consent=${cookie}` },
        body: JSON.stringify({
          googleAnalytics: {
            measurementId: 'G-TEST',
            clientId: '123.456',
            sessionId: '789',
            adMeasurementAllowed: !advertising,
            gclid: 'MUST_NOT_STORE',
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      userId: 'owner',
      clientId: '123.456',
      sessionId: '789',
      adMeasurementAllowed: advertising,
    });
    expect(JSON.stringify(mocks.create.mock.calls)).not.toContain('MUST_NOT_STORE');
  },
);
it('GPC refuses checkout measurement even when a cookie claims both permissions', async () => {
  const cookie = encodeURIComponent(
    JSON.stringify({
      version: 'v1',
      date: new Date().toISOString(),
      accepted: true,
      advertising: true,
    }),
  );
  await POST(
    new Request('https://easyrender.ai/api/checkout', {
      method: 'POST',
      headers: { 'sec-gpc': '1', cookie: `er_consent=${cookie}` },
      body: JSON.stringify({
        googleAnalytics: { measurementId: 'G-TEST', clientId: '123.456', sessionId: '789' },
      }),
    }),
  );
  expect(mocks.create).not.toHaveBeenCalled();
});
it('withdrawal revokes only the signed-in account pending contexts and rejects cross-origin calls', async () => {
  expect(
    (
      await revoke(
        new Request('https://easyrender.ai/api/analytics/revoke', {
          method: 'POST',
          headers: { origin: 'https://other.invalid' },
        }),
      )
    ).status,
  ).toBe(403);
  expect(mocks.revoke).not.toHaveBeenCalled();
  expect(
    (
      await revoke(
        new Request('https://easyrender.ai/api/analytics/revoke', {
          method: 'POST',
          headers: { origin: 'https://easyrender.ai' },
        }),
      )
    ).status,
  ).toBe(204);
  expect(mocks.revoke.mock.calls[0][0]).toEqual({
    where: { userId: 'owner', revokedAt: null },
    data: { revokedAt: expect.any(Date) },
  });
});

it('does not block the confirmed checkout URL when optional measurement persistence fails', async () => {
  mocks.create.mockRejectedValueOnce(new Error('measurement database unavailable'));
  const cookie = encodeURIComponent(
    JSON.stringify({
      version: 'v1',
      date: new Date().toISOString(),
      accepted: true,
      advertising: true,
    }),
  );
  const response = await POST(
    new Request('https://easyrender.ai/api/checkout', {
      method: 'POST',
      headers: { cookie: `er_consent=${cookie}` },
      body: JSON.stringify({
        googleAnalytics: { measurementId: 'G-TEST', clientId: '123.456', sessionId: '789' },
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ url: 'https://checkout.invalid', analytics: {} });
});

it.each([
  ['MX', null, false, true],
  ['US', null, false, true],
  ['BR', null, false, true],
  ['ES', null, false, false],
  ['XX', null, false, false],
  ['MX', false, false, false],
  ['US', null, true, false],
] as const)(
  'checkout in %s with choice %s and GPC %s stores measurement: %s',
  async (country, accepted, hasGpc, hasMeasurement) => {
    const headers = new Headers({ 'x-vercel-ip-country': country });
    if (hasGpc) headers.set('sec-gpc', '1');
    if (accepted !== null)
      headers.set(
        'cookie',
        `er_consent=${encodeURIComponent(JSON.stringify({ version: 'v1', date: new Date().toISOString(), accepted }))}`,
      );
    const response = await POST(
      new Request('https://easyrender.ai/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          googleAnalytics: {
            measurementId: 'G-TEST',
            clientId: '123.456',
            sessionId: '789',
            adMeasurementAllowed: !hasMeasurement,
            gclid: 'MUST_NOT_STORE',
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
    if (hasMeasurement) {
      expect(mocks.create.mock.calls[0][0].data).toMatchObject({ adMeasurementAllowed: true });
      expect(JSON.stringify(mocks.create.mock.calls)).not.toContain('MUST_NOT_STORE');
    } else expect(mocks.create).not.toHaveBeenCalled();
  },
);

it('keeps standard-region analytics-only checkout contexts free of advertising permission', async () => {
  await POST(
    new Request('https://easyrender.ai/api/checkout', {
      method: 'POST',
      headers: {
        'x-vercel-ip-country': 'MX',
        cookie: `er_consent=${encodeURIComponent(JSON.stringify({ version: 'v1', date: new Date().toISOString(), accepted: true, advertising: false }))}`,
      },
      body: JSON.stringify({
        googleAnalytics: {
          measurementId: 'G-TEST',
          clientId: '123.456',
          sessionId: '789',
          adMeasurementAllowed: true,
        },
      }),
    }),
  );
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({ adMeasurementAllowed: false });
});

it.each([
  ['accepted', 'ES', true, true, false, true, true],
  ['analytics only', 'ES', true, false, false, true, false],
  ['rejected', 'US', false, false, false, false, false],
  ['region required', 'ES', null, false, false, false, false],
  ['unknown region', 'XX', null, false, false, false, false],
  ['GPC', 'US', true, true, true, false, false],
  ['regional default', 'US', null, false, false, true, true],
] as const)(
  'server sanitizes checkout attribution for %s independently of forged client grants',
  async (_label, country, accepted, advertising, hasGpc, hasIds, hasAds) => {
    const headers = new Headers({ 'x-vercel-ip-country': country });
    if (hasGpc) headers.set('sec-gpc', '1');
    if (accepted !== null)
      headers.set(
        'cookie',
        `er_consent=${encodeURIComponent(JSON.stringify({ version: 'v1', date: new Date().toISOString(), accepted, advertising }))}`,
      );
    await POST(
      new Request('https://easyrender.ai/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          attribution: {
            posthog_distinct_id: 'browser-fixture',
            posthog_session_id: '019a0000-0000-7000-8000-000000000001',
            gclid: 'Allowed_123',
            gbraid: 'Braid_123',
            wbraid: 'Web_123',
            landing_path: '/es?email=private',
            referrer_host: 'www.google.com',
            utm_source: 'google',
            isAnalyticsAllowed: true,
            isAdvertisingAllowed: true,
          },
        }),
      }),
    );
    const context = mocks.checkout.mock.calls[0] as unknown as [
      string,
      unknown,
      { checkoutAttribution: Record<string, string> },
    ];
    const attribution = context[2].checkoutAttribution;
    expect(attribution).toMatchObject({
      landing_path: '/es',
      referrer_host: 'www.google.com',
      utm_source: 'google',
    });
    expect(Boolean(attribution.posthog_distinct_id)).toBe(hasIds);
    expect(Boolean(attribution.posthog_session_id)).toBe(hasIds);
    for (const key of ['gclid', 'gbraid', 'wbraid']) expect(Boolean(attribution[key])).toBe(hasAds);
    expect(JSON.stringify(attribution)).not.toMatch(
      /email|private|isAnalyticsAllowed|isAdvertisingAllowed/,
    );
  },
);
