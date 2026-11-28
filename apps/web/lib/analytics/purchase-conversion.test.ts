import type { confirmedPurchase } from '@easyrender/core';
import { classifyCountry, isToolAllowed } from '@easyrender/core/attribution';
import { afterEach, expect, it, vi } from 'vitest';
import { GOOGLE_ADS_PURCHASE_SEND_TO } from '../google-tag';
import { allowsAdvertisingMeasurement } from './consent';

type Confirmation = NonNullable<Awaited<ReturnType<typeof confirmedPurchase>>>;
const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
  capture: vi.fn(),
  set_config: vi.fn(),
  reset: vi.fn(),
  get_distinct_id: vi.fn(() => 'browser-fixture'),
  get_session_id: vi.fn(() => '019a0000-0000-7000-8000-000000000001'),
}));
vi.mock('posthog-js', () => {
  sdk.init.mockReturnValue(sdk);
  return { default: sdk };
});
const saved = new Map<string, string>();
const confirmation: Confirmation = {
  transaction_id: 'cs_fixture',
  issued_credits: 500,
  value: 5,
  currency: 'EUR',
  pricing_variant: 'control',
  server_managed: false,
  items: [{ item_id: 'payg', quantity: 1, price: 5 }],
  posthog: {
    id: '019a0000-0000-5000-a000-000000000001',
    distinctId: 'browser-fixture',
    occurredAt: '2026-11-21T12:00:00.000Z',
    properties: {
      posthog_session_id: '019a0000-0000-7000-8000-000000000001',
      $session_id: '019a0000-0000-7000-8000-000000000001',
      revenue: 5,
      currency: 'EUR',
      gclid: 'Ad_123',
    },
  },
};
async function browser(
  options: {
    country?: string;
    accepted?: boolean;
    advertising?: boolean;
    hasGpc?: boolean;
    url?: string;
    hasGa?: boolean;
  } = {},
) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'fixture-public-key');
  const location = new URL(
    options.url ??
      'https://easyrender.ai/es?utm_source=google&utm_medium=cpc&gclid=Ad_123&email=private',
  );
  const gtag = vi.fn();
  vi.stubGlobal('location', location);
  vi.stubGlobal('window', {
    location,
    gtag,
    __erGoogleTagLoaded: true,
    history: {
      state: null,
      replaceState: (_state: unknown, _title: string, url: string) => {
        location.href = String(url);
      },
    },
  });
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 Chrome/130.0',
    globalPrivacyControl: options.hasGpc === true,
  });
  const choice = { accepted: options.accepted ?? null, advertising: options.advertising ?? false };
  const document = {
    cookie:
      choice.accepted === null
        ? ''
        : `er_consent=${encodeURIComponent(JSON.stringify({ ...choice, version: 'v1', date: new Date().toISOString() }))}`,
    referrer: 'https://www.google.com/search?email=private',
    documentElement: { lang: 'es', dataset: {} },
  };
  vi.stubGlobal('document', document);
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  sdk.capture.mockReturnValue({ event: 'captured' });
  const api = await import('./browser');
  if (options.hasGa !== false) api.initializeGa('G-TEST');
  const region = {
    ...classifyCountry(options.country ?? 'ES'),
    config_version: 'v1',
    gpc: options.hasGpc === true,
  };
  const isAllowed = isToolAllowed('ga4', region.consent_region, choice.accepted, region.gpc);
  await api.setBrowserTools(
    true,
    isAllowed,
    choice.accepted === false || region.gpc,
    allowsAdvertisingMeasurement(region, choice),
    isAllowed,
  );
  return { api, gtag, location, document };
}
afterEach(() => {
  saved.clear();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('passes browser session and distinct IDs plus first touch to checkout only with permission, without storing SDK IDs', async () => {
  const page = await browser({ accepted: true, advertising: true });
  expect(page.api.checkoutAttribution()).toMatchObject({
    landing_path: '/es',
    referrer_host: 'www.google.com',
    utm_source: 'google',
    utm_medium: 'cpc',
    posthog_distinct_id: 'browser-fixture',
    posthog_session_id: sdk.get_session_id(),
    gclid: 'Ad_123',
  });
  expect(sdk.init.mock.calls[0][1]).toMatchObject({
    cookieless_mode: undefined,
    persistence: 'memory',
    disable_persistence: true,
    person_profiles: 'never',
  });
  expect(JSON.stringify([...saved.values()])).not.toContain('browser-fixture');
  expect(JSON.stringify(page.api.checkoutAttribution())).not.toMatch(/email|private|search/);
});

it.each([
  ['rejected', { accepted: false, country: 'US' }],
  ['required not given', { country: 'ES' }],
  ['unknown region', { country: 'XX' }],
  ['GPC', { country: 'US', accepted: true, advertising: true, hasGpc: true }],
] as const)(
  'keeps %s cookieless and sends/stores no optional IDs or click data',
  async (_label, options) => {
    const page = await browser(options);
    expect(sdk.init.mock.calls[0][1].cookieless_mode).toBe('always');
    const touch = page.api.checkoutAttribution();
    expect(touch).not.toHaveProperty('posthog_distinct_id');
    expect(touch).not.toHaveProperty('posthog_session_id');
    expect(touch).not.toHaveProperty('gclid');
    page.api.reportPurchaseConversion(confirmation);
    expect(sdk.capture.mock.calls.filter(([event]) => event === 'purchase_completed')).toHaveLength(
      0,
    );
    expect(
      page.gtag.mock.calls.filter(
        ([command, event]) => command === 'event' && event === 'purchase',
      ),
    ).toHaveLength(0);
    expect(saved.size).toBe(0);
  },
);

it('supports analytics identities without Google configuration and with analytics-only consent', async () => {
  const page = await browser({ accepted: true, hasGa: false });
  expect(page.api.checkoutAttribution()).toHaveProperty('posthog_distinct_id', 'browser-fixture');
  expect(page.api.checkoutAttribution()).not.toHaveProperty('gclid');
  page.api.reportPurchaseConversion(confirmation);
  expect(sdk.capture.mock.calls.filter(([event]) => event === 'purchase_completed')).toHaveLength(
    1,
  );
  expect(
    page.gtag.mock.calls.filter(([command, event]) => command === 'event' && event === 'purchase'),
  ).toHaveLength(0);
});

it('retains the first landing and campaign through full navigation, using sessionStorage under the regional default', async () => {
  const first = await browser({ country: 'US' });
  const original = first.api.checkoutAttribution();
  const second = await browser({
    country: 'US',
    url: 'https://easyrender.ai/credits?utm_source=internal',
  });
  expect(second.api.checkoutAttribution()).toMatchObject({
    landing_path: original.landing_path,
    utm_source: 'google',
  });
  await second.api.setBrowserTools(true, false, true);
  expect(saved.has('er_campaign')).toBe(false);
  expect(saved.has('er_ad_touch')).toBe(false);
  expect(second.api.checkoutAttribution()).not.toHaveProperty('posthog_distinct_id');
  expect(sdk.init.mock.calls.at(-1)?.[1].cookieless_mode).toBe('always');
});

it('closes PostHog, GA and Ads once across polling and reloads, using the verified event identity and paid time', async () => {
  for (let reload = 0; reload < 2; reload++) {
    const page = await browser({ accepted: true, advertising: true });
    page.api.reportPurchaseConversion(confirmation);
    page.api.reportPurchaseConversion(confirmation);
    expect(
      page.gtag.mock.calls.filter(
        ([command, event]) => command === 'event' && event === 'purchase',
      ),
    ).toHaveLength(reload === 0 ? 1 : 0);
    expect(
      page.gtag.mock.calls.filter(
        ([command, event]) => command === 'event' && event === 'conversion',
      ),
    ).toHaveLength(reload === 0 ? 1 : 0);
    if (reload === 0) {
      const captured = sdk.capture.mock.calls.find(([event]) => event === 'purchase_completed');
      expect(captured).toEqual([
        'purchase_completed',
        expect.objectContaining({ distinct_id: 'browser-fixture', revenue: 5 }),
        { uuid: confirmation.posthog?.id, timestamp: new Date('2026-11-21T12:00:00.000Z') },
      ]);
      // Model the SDK replacing $session_id before its before_send hook.
      const beforeSend = sdk.init.mock.calls.at(-1)?.[1].before_send;
      const event = beforeSend({
        event: 'purchase_completed',
        properties: { ...captured?.[1], $session_id: 'return-page-session' },
      });
      expect(event.properties.$session_id).toBe(sdk.get_session_id());
      expect(event.properties.distinct_id).toBe('browser-fixture');
      expect(event.properties).not.toHaveProperty('gclid');
    }
  }
  expect(sdk.capture.mock.calls.filter(([event]) => event === 'purchase_completed')).toHaveLength(
    1,
  );
});

it('server_managed suppresses GA4 but still sends the verified Ads and PostHog purchase', async () => {
  const page = await browser({ accepted: true, advertising: true });
  page.api.reportPurchaseConversion({ ...confirmation, server_managed: true });
  expect(page.gtag).toHaveBeenCalledWith(
    'event',
    'conversion',
    expect.objectContaining({
      send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
      value: 5,
      currency: 'EUR',
      transaction_id: 'cs_fixture',
    }),
  );
  expect(sdk.capture.mock.calls.filter(([event]) => event === 'purchase_completed')).toHaveLength(
    1,
  );
  expect(
    page.gtag.mock.calls.filter(([command, event]) => command === 'event' && event === 'purchase'),
  ).toHaveLength(0);
});

it('rechecks rejection and GPC at send time, including after a confirmed response arrives', async () => {
  const page = await browser({ accepted: true, advertising: true });
  page.document.cookie = `er_consent=${encodeURIComponent(JSON.stringify({ accepted: false, advertising: false, version: 'v1', date: new Date().toISOString() }))}`;
  expect(page.api.checkoutAttribution()).not.toHaveProperty('posthog_distinct_id');
  page.api.reportPurchaseConversion(confirmation);
  expect(sdk.capture.mock.calls.filter(([event]) => event === 'purchase_completed')).toHaveLength(
    0,
  );
  page.document.cookie = '';
  vi.stubGlobal('navigator', { globalPrivacyControl: true });
  page.api.reportPurchaseConversion(confirmation);
  expect(page.api.checkoutAttribution()).not.toHaveProperty('gclid');
  expect(sdk.capture.mock.calls.filter(([event]) => event === 'purchase_completed')).toHaveLength(
    0,
  );
});

it('deduplicates in memory when sessionStorage is unavailable and retries when capture was not accepted', async () => {
  const page = await browser({ accepted: true, advertising: true });
  vi.stubGlobal('sessionStorage', {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  });
  sdk.capture.mockReturnValueOnce(undefined);
  page.api.reportPurchaseConversion(confirmation);
  page.api.reportPurchaseConversion(confirmation);
  page.api.reportPurchaseConversion(confirmation);
  expect(sdk.capture.mock.calls.filter(([event]) => event === 'purchase_completed')).toHaveLength(
    2,
  );
  expect(
    page.gtag.mock.calls.filter(([command, event]) => command === 'event' && event === 'purchase'),
  ).toHaveLength(1);
});

it('initializes separate SDK sessions after a grant, blocks the inactive instance, and erases identity on rejection', async () => {
  const page = await browser({ country: 'ES' });
  const cookielessBeforeSend = sdk.init.mock.calls[0][1].before_send;
  expect(sdk.init.mock.calls[0][2]).toBe('er_cookieless');
  const event = { event: 'checkout_started', properties: {} };
  expect(cookielessBeforeSend(event)).not.toBeNull();
  page.document.cookie = `er_consent=${encodeURIComponent(JSON.stringify({ accepted: true, advertising: true, version: 'v1', date: new Date().toISOString() }))}`;
  await page.api.setBrowserTools(true, true, false, true, true);
  expect(sdk.init.mock.calls[1][2]).toBe('er_consented');
  const consentedBeforeSend = sdk.init.mock.calls[1][1].before_send;
  expect(cookielessBeforeSend(event)).toBeNull();
  expect(consentedBeforeSend(event)).not.toBeNull();
  expect(page.api.checkoutAttribution()).toHaveProperty('posthog_session_id', sdk.get_session_id());
  await page.api.setBrowserTools(true, false, true);
  expect(consentedBeforeSend(event)).toBeNull();
  expect(cookielessBeforeSend(event)).not.toBeNull();
  expect(sdk.reset).toHaveBeenCalledWith(true);
  expect(sdk.init).toHaveBeenCalledTimes(2);
});

it('does not send Google checkout IDs if consent changes while gtag callbacks are in flight', async () => {
  const page = await browser({ accepted: true, advertising: true });
  const callbacks: Array<(value: string) => void> = [];
  page.gtag.mockImplementation((...args: unknown[]) => {
    if (args[0] === 'get') callbacks.push(args[3] as (value: string) => void);
  });
  const pending = page.api.googleCheckoutContext();
  await page.api.setBrowserTools(true, false, true);
  callbacks[0]('123.456');
  callbacks[1]('789');
  expect(await pending).toBeNull();
});

it('deduplicates Ads by transaction across identities and reloads, and keeps optional fields optional', async () => {
  for (let reload = 0; reload < 2; reload++) {
    const page = await browser({ accepted: true, advertising: true });
    page.api.adsConversion(GOOGLE_ADS_PURCHASE_SEND_TO, 'first', {
      value: 12.34,
      currency: 'EUR',
      transactionId: 'cs_amount',
    });
    page.api.adsConversion(GOOGLE_ADS_PURCHASE_SEND_TO, 'second', {
      value: 12.34,
      currency: 'EUR',
      transactionId: 'cs_amount',
    });
    const events = page.gtag.mock.calls.filter(([c, e]) => c === 'event' && e === 'conversion');
    expect(events).toHaveLength(reload === 0 ? 1 : 0);
    if (reload === 0)
      expect(events[0][2]).toMatchObject({
        send_to: GOOGLE_ADS_PURCHASE_SEND_TO,
        value: 12.34,
        currency: 'EUR',
        transaction_id: 'cs_amount',
      });
  }
});
it.each([false, true])(
  'requires advertising permission for Ads purchase options (advertising=%s)',
  async (advertising) => {
    const page = await browser({ accepted: true, advertising });
    page.api.adsConversion(GOOGLE_ADS_PURCHASE_SEND_TO, 'cs_consent', {
      value: 5,
      currency: 'EUR',
      transactionId: 'cs_consent',
    });
    expect(
      page.gtag.mock.calls.filter(([c, e]) => c === 'event' && e === 'conversion'),
    ).toHaveLength(advertising ? 1 : 0);
  },
);
