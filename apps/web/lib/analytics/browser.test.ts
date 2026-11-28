import { runInNewContext } from 'node:vm';
import { classifyCountry, isToolAllowed } from '@easyrender/core/attribution';
import { afterEach, expect, it, vi } from 'vitest';
import { GOOGLE_TAG_BOOTSTRAP } from '../google-tag';
import { beforeSend } from './browser';

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
  capture: vi.fn(),
}));
vi.mock('posthog-js', () => ({ default: sdk }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('before_send retains the public SDK project key required for ingestion and strips all non-UTM URL data', () => {
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_localtest');
  const event = beforeSend({
    properties: {
      token: 'phc_localtest',
      $current_url: 'https://example.test/?utm_source=test&foo=1&gclid=abc',
      $referrer: 'https://ref.test/?private=1',
      title: 'private account name',
      fbclid: 'abc',
      gbraid: 'must-not-send',
      wbraid: 'must-not-send',
      dclid: 'must-not-send',
      referrer_host: 'external.test',
    },
  });
  expect(event.properties).toEqual({
    pricing_subject: null,
    pricing_variant: 'control',
    '$feature/pricing-test-2026-11': 'control',
    token: 'phc_localtest',
    $current_url: 'https://example.test/?utm_source=test',
    $referrer: 'https://ref.test/',
    referrer_host: 'external.test',
  });
});

async function googleBrowser(
  hostname = 'easyrender.ai',
  navigator: { userAgent?: string; webdriver?: boolean } = {
    userAgent: 'Mozilla/5.0 Chrome/130.0',
  },
) {
  vi.resetModules();
  const scripts: Array<{ src?: string }> = [];
  const dataLayer: unknown[] = [{ event: 'existing-event' }];
  const location = new URL(`https://${hostname}/credits?utm_source=test&email=private#secret`);
  const window = { location, dataLayer };
  vi.stubGlobal('navigator', navigator);
  const document = {
    referrer: 'https://external.test/path?token=private#secret',
    cookie: '',
    createElement: () => ({}),
    head: { appendChild: (script: { src?: string }) => scripts.push(script) },
  };
  const bootstrap = () =>
    runInNewContext(GOOGLE_TAG_BOOTSTRAP, { window, document, navigator, URL });
  bootstrap();
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', document);
  vi.stubGlobal('location', location);
  const api = await import('./browser');
  const commands = () => dataLayer.slice(1).map((entry) => Array.from(entry as ArrayLike<unknown>));
  return { api, bootstrap, window, dataLayer, scripts, commands };
}
it('reuses the bootstrap queue and sole loader, sanitizes GA URLs and routes conversions only to GA', async () => {
  const page = await googleBrowser();
  page.api.initializeGa('G-TEST000000');
  page.api.initializeGa('G-TEST000000');
  await page.api.setBrowserTools(false, true);
  page.api.gaEvent('purchase', { transaction_id: 'invoice-1' }, 'invoice-1');
  page.api.gaEvent('purchase', { transaction_id: 'invoice-1' }, 'invoice-1');
  page.window.location.pathname = '/dashboard';
  page.api.gaPageview();
  page.api.gaPageview();
  page.bootstrap();
  expect(page.window.dataLayer).toBe(page.dataLayer);
  expect(page.dataLayer[0]).toEqual({ event: 'existing-event' });
  expect(page.scripts).toEqual([
    { async: true, src: 'https://www.googletagmanager.com/gtm.js?id=AW-18570382360' },
  ]);
  expect(page.commands().filter(([c, type]) => c === 'consent' && type === 'default')).toHaveLength(
    1,
  );
  expect(page.commands().filter(([c]) => c === 'js')).toHaveLength(1);
  expect(page.commands().filter(([c]) => c === 'config')).toHaveLength(1);
  expect(page.commands().filter(([c, type]) => c === 'event' && type === 'page_view')).toHaveLength(
    2,
  );
  expect(page.commands().filter(([c, type]) => c === 'event' && type === 'purchase')).toEqual([
    [
      'event',
      'purchase',
      {
        pricing_variant: 'control',
        transaction_id: 'invoice-1',
        send_to: 'G-TEST000000',
        page_location: 'https://easyrender.ai/credits?utm_source=test',
        page_referrer: 'https://external.test/path',
      },
    ],
  ]);
  expect(page.commands()).toContainEqual([
    'config',
    'G-TEST000000',
    {
      send_page_view: false,
      page_location: 'https://easyrender.ai/credits?utm_source=test',
      page_referrer: 'https://external.test/path',
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    },
  ]);
  expect(JSON.stringify(page.commands())).not.toMatch(/private|secret/);
  expect(page.commands()).toContainEqual(['set', 'ads_data_redaction', true]);
});
it.each([
  ['DE', false, 'denied'],
  ['GB', false, 'denied'],
  ['CH', false, 'denied'],
  [null, false, 'denied'],
  ['US', false, 'granted'],
  ['US', true, 'denied'],
] as const)(
  'updates bootstrap consent for %s, GPC=%s without granting advertising',
  async (country, hasGpc, consent) => {
    const page = await googleBrowser();
    page.api.initializeGa('G-TEST000000');
    const region = classifyCountry(country);
    await page.api.setBrowserTools(
      false,
      isToolAllowed('ga4', region.consent_region, null, hasGpc),
    );
    expect(page.commands()).toContainEqual([
      'consent',
      'update',
      {
        analytics_storage: consent,
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ]);
    expect(page.commands().filter(([c]) => c === 'config')).toHaveLength(
      consent === 'granted' ? 1 : 0,
    );
  },
);
it('withdrawal disables GA events and accepting again reuses the same loader', async () => {
  const page = await googleBrowser();
  page.api.initializeGa('G-TEST000000');
  await page.api.setBrowserTools(false, true);
  await page.api.setBrowserTools(false, false, true);
  const before = page.commands().length;
  page.api.gaEvent('sign_up');
  page.api.gaPageview();
  expect(page.commands()).toHaveLength(before);
  expect(page.window).toHaveProperty('ga-disable-G-TEST000000', true);
  await page.api.setBrowserTools(false, true);
  expect(page.window).toHaveProperty('ga-disable-G-TEST000000', false);
  expect(page.scripts).toHaveLength(1);
  expect(page.commands().filter(([c]) => c === 'config')).toHaveLength(1);
});
it('unset GA ID leaves only the denied Ads bootstrap', async () => {
  const page = await googleBrowser();
  page.api.initializeGa('');
  await page.api.setBrowserTools(false, true);
  page.api.gaEvent('purchase');
  expect(page.commands().filter(([c]) => ['config', 'event'].includes(String(c)))).toEqual([]);
  expect(page.scripts).toHaveLength(1);
});
it.each(['localhost', 'preview.vercel.app', 'easyrender.ai.example.com'])(
  'does not initialize Google analytics on %s even with GA configured',
  async (hostname) => {
    const page = await googleBrowser(hostname);
    page.api.initializeGa('G-TEST000000');
    await page.api.setBrowserTools(false, true);
    page.api.gaEvent('purchase');
    expect(page.scripts).toEqual([]);
    expect(page.commands()).toEqual([]);
  },
);

it('preserves campaign attribution explicitly without restoring private URL parameters', async () => {
  const page = await googleBrowser();
  page.api.initializeGa('G-TEST000000');
  await page.api.setBrowserTools(false, true);
  expect(page.commands()).toContainEqual([
    'set',
    expect.objectContaining({ campaign_source: 'test' }),
  ]);
  expect(JSON.stringify(page.commands())).not.toMatch(/email=|private|#secret/);
});
it('does not report a historical render as a new activation, including after reload', async () => {
  for (let reload = 0; reload < 2; reload++) {
    const page = await googleBrowser();
    page.api.initializeGa('G-TEST000000');
    await page.api.setBrowserTools(false, true);
    page.api.observeRender({ id: 'historical', status: 'ready', hasSheet: true });
    expect(
      page
        .commands()
        .filter(([c, e]) => c === 'event' && ['preview_ready', 'render_ready'].includes(String(e))),
    ).toEqual([]);
  }
});
it('reports each observed render transition once instead of each poll', async () => {
  const page = await googleBrowser();
  page.api.initializeGa('G-TEST000000');
  await page.api.setBrowserTools(false, true);
  page.api.observeRender({ id: 'new', status: 'drafting', hasSheet: false });
  page.api.observeRender({ id: 'new', status: 'preview_ready', hasSheet: true });
  page.api.observeRender({ id: 'new', status: 'rendering', hasSheet: true });
  page.api.observeRender({ id: 'new', status: 'ready', hasSheet: true });
  page.api.observeRender({ id: 'new', status: 'ready', hasSheet: true });
  expect(page.commands().filter(([c, e]) => c === 'event' && e === 'preview_ready')).toHaveLength(
    1,
  );
  expect(page.commands().filter(([c, e]) => c === 'event' && e === 'render_ready')).toHaveLength(1);
});
it('does not trust an OAuth signup query parameter as a completed registration', async () => {
  const page = await googleBrowser();
  page.window.location.search = '?__signup=google';
  page.api.initializeGa('G-TEST000000');
  await page.api.setBrowserTools(false, true);
  expect(page.commands().filter(([c, e]) => c === 'event' && e === 'sign_up')).toEqual([]);
});
it('keeps campaign context across documents only while analytics storage is allowed and clears it on withdrawal', async () => {
  const saved = new Map<string, string>();
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  };
  vi.stubGlobal('sessionStorage', storage);
  const first = await googleBrowser();
  first.api.initializeGa('G-TEST000000');
  await first.api.setBrowserTools(false, true);
  const second = await googleBrowser();
  second.window.location.search = '';
  second.api.initializeGa('G-TEST000000');
  await second.api.setBrowserTools(false, true);
  expect(second.api.attribution()?.utm_source).toBe('test');
  await second.api.setBrowserTools(false, false, true);
  expect(saved.size).toBe(0);
});

it('requires advertising opt-in independently and clears bounded IDs on withdrawal while analytics stays enabled', async () => {
  const saved = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  });
  const removeLocal = vi.fn();
  vi.stubGlobal('localStorage', { removeItem: removeLocal });
  const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetcher);
  const page = await googleBrowser();
  page.window.location.search = '?gclid=Allowed_123&email=private';
  page.api.initializeGa('G-TEST000000');
  await page.api.setBrowserTools(false, true);
  expect(JSON.stringify(page.commands())).not.toContain('Allowed_123');
  expect(saved.has('er_ad_touch')).toBe(false);
  await page.api.setBrowserTools(false, true, false, true);
  expect(page.commands()).toContainEqual([
    'consent',
    'update',
    {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'denied',
    },
  ]);
  expect(saved.get('er_ad_touch')).toContain('Allowed_123');
  expect(JSON.stringify(page.commands())).not.toContain('email=');
  const before = page.commands().length;
  await page.api.setBrowserTools(false, true, false, false);
  expect(saved.has('er_ad_touch')).toBe(false);
  expect(removeLocal).toHaveBeenCalledWith('_gcl_ls');
  expect(fetcher).toHaveBeenCalledWith(
    '/api/analytics/revoke',
    expect.objectContaining({ method: 'POST' }),
  );
  expect(JSON.stringify(page.commands().slice(before))).not.toContain('Allowed_123');
  expect(page.commands().slice(before)).toContainEqual(['set', 'ads_data_redaction', true]);
});

it('expires advertising IDs after thirty minutes without extending them on a permission refresh', async () => {
  vi.useFakeTimers();
  try {
    const saved = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
      removeItem: (key: string) => saved.delete(key),
    });
    const page = await googleBrowser();
    page.window.location.search = '?gclid=Expiring_123';
    page.api.initializeGa('G-TEST000000');
    await page.api.setBrowserTools(false, true, false, true);
    const original = JSON.parse(saved.get('er_ad_touch') ?? 'null');
    page.window.location.search = '';
    vi.advanceTimersByTime(10 * 60 * 1000);
    await page.api.setBrowserTools(false, true, false, true);
    expect(JSON.parse(saved.get('er_ad_touch') ?? 'null').expiresAt).toBe(original.expiresAt);
    vi.advanceTimersByTime(20 * 60 * 1000 + 1);
    expect(saved.has('er_ad_touch')).toBe(false);
    const before = page.commands().length;
    page.api.gaEvent('begin_checkout');
    expect(JSON.stringify(page.commands().slice(before))).not.toContain('Expiring_123');
  } finally {
    vi.useRealTimers();
  }
});

it('does not grant advertising when a withdrawal/GPC signal is present, even with a stale grant argument', async () => {
  const page = await googleBrowser();
  page.api.initializeGa('G-TEST000000');
  await page.api.setBrowserTools(false, true, true, true);
  const updates = page.commands().filter(([c, type]) => c === 'consent' && type === 'update');
  expect(updates.at(-1)).toEqual([
    'consent',
    'update',
    {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    },
  ]);
});

it('does not send GA pageviews or conversions from email token pages after client navigation', async () => {
  const page = await googleBrowser();
  page.api.initializeGa('G-TEST000000');
  await page.api.setBrowserTools(false, true);
  const before = page.commands().filter(([command]) => command === 'event').length;
  page.window.location.pathname = '/email/confirm';
  page.window.location.search = '?token=private';
  page.api.gaPageview();
  page.api.gaEvent('sign_up', { method: 'email' });
  expect(page.commands().filter(([command]) => command === 'event')).toHaveLength(before);
});

it.each(['email', 'google'])(
  'sends a real %s signup directly to Ads once, with only permitted URL fields',
  async (method) => {
    const page = await googleBrowser();
    page.window.location.search = '?gclid=Allowed_123&email=private&token=private';
    page.api.initializeGa('G-TEST000000');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await page.api.setBrowserTools(false, true, false, true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ method })),
    );
    await Promise.all([page.api.captureSignup(), page.api.captureSignup()]);
    expect(page.commands().filter(([c, e]) => c === 'event' && e === 'conversion')).toEqual([
      [
        'event',
        'conversion',
        {
          send_to: 'AW-18570382360/Uh3CCIiymr0dEJiYhpdF',
          page_location: 'https://easyrender.ai/credits?gclid=Allowed_123',
          page_referrer: 'https://external.test/path',
        },
      ],
    ]);
    expect(page.commands().filter(([c, e]) => c === 'event' && e === 'sign_up')).toContainEqual([
      'event',
      'sign_up',
      expect.objectContaining({ send_to: 'G-TEST000000', method }),
    ]);
  },
);

it.each([
  ['analytics only', true, false, false],
  ['rejected', false, true, false],
  ['GPC', false, true, true],
] as const)(
  'does not send a signup to Ads with %s',
  async (_label, hasGa, hasWithdrawal, hasAds) => {
    const page = await googleBrowser();
    page.api.initializeGa('G-TEST000000');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ method: 'email' })),
    );
    await page.api.setBrowserTools(false, hasGa, hasWithdrawal, hasAds);
    await page.api.captureSignup();
    expect(page.commands().filter(([c, e]) => c === 'event' && e === 'conversion')).toEqual([]);
  },
);

it.each(['localhost', 'preview.vercel.app'])(
  'never sends Ads conversions from %s',
  async (hostname) => {
    const page = await googleBrowser();
    page.api.initializeGa('G-TEST000000');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await page.api.setBrowserTools(false, true, false, true);
    // Keep an initialized tag to exercise the send-time hostname guard too.
    page.window.location.hostname = hostname;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ method: 'email' })),
    );
    await page.api.captureSignup();
    expect(page.commands().filter(([c, e]) => c === 'event' && e === 'conversion')).toEqual([]);
  },
);

it.each([
  '/email/confirm?token=private',
  '/email/unsubscribe?token=private',
  '/invite/private',
  '/reset-password/private',
  '/verify-email?token=private',
  '/sign-in?next=%2Finvite%2Fprivate',
])('never sends a signup conversion from token page %s', async (path) => {
  const page = await googleBrowser();
  page.api.initializeGa('G-TEST000000');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  await page.api.setBrowserTools(false, true, false, true);
  page.window.location.href = `https://easyrender.ai${path}`;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ method: 'email' })),
  );
  await page.api.captureSignup();
  expect(page.commands().filter(([c, e]) => c === 'event' && e === 'conversion')).toEqual([]);
});

it('does not repeat a claimed receipt across document reloads or invent a signup from a login', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ method: 'google' }))
    .mockImplementation(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetcher);
  let conversions = 0;
  for (let reload = 0; reload < 2; reload++) {
    const page = await googleBrowser();
    page.api.initializeGa('G-TEST000000');
    await page.api.setBrowserTools(false, true, false, true);
    await page.api.captureSignup();
    conversions += page.commands().filter(([c, e]) => c === 'event' && e === 'conversion').length;
  }
  expect(conversions).toBe(1);
});

it('rechecks advertising permission when an in-flight signup receipt arrives', async () => {
  const page = await googleBrowser();
  page.api.initializeGa('G-TEST000000');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  await page.api.setBrowserTools(false, true, false, true);
  const receipt = Promise.withResolvers<Response>();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => receipt.promise),
  );
  const capture = page.api.captureSignup();
  await page.api.setBrowserTools(false, false, true, false);
  receipt.resolve(Response.json({ method: 'email' }));
  await capture;
  expect(page.commands().filter(([c, e]) => c === 'event' && e === 'conversion')).toEqual([]);
});

it.each(['MX', 'US', 'BR', 'ES', 'DE', 'XX'])(
  'applies the shared regional advertising default to browser signup in %s',
  async (country) => {
    const page = await googleBrowser();
    const { allowsAdvertisingMeasurement } = await import('./consent');
    const region = { ...classifyCountry(country), gpc: false, config_version: 'v1' };
    const choice = { accepted: null, advertising: false };
    page.api.initializeGa('G-TEST000000');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await page.api.setBrowserTools(
      false,
      isToolAllowed('ga4', region.consent_region, choice.accepted, region.gpc),
      false,
      allowsAdvertisingMeasurement(region, choice),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ method: 'email' })),
    );
    await page.api.captureSignup();
    expect(page.commands().filter(([c, e]) => c === 'event' && e === 'conversion')).toHaveLength(
      region.consent_region === 'standard' ? 1 : 0,
    );
  },
);

it('does not send or throw if gtag becomes unavailable before signup completes', async () => {
  const page = await googleBrowser();
  page.api.initializeGa('G-TEST000000');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  await page.api.setBrowserTools(false, true, false, true);
  Object.assign(page.window, { gtag: undefined });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ method: 'email' })),
  );
  await expect(page.api.captureSignup()).resolves.toBeUndefined();
  expect(page.commands().filter(([c, e]) => c === 'event' && e === 'conversion')).toEqual([]);
});

it.each([null, {}, { method: 'login' }, { method: 'email', status: 500 }])(
  'does not invent an Ads signup from an invalid or failed receipt: %j',
  async (result) => {
    const page = await googleBrowser();
    page.api.initializeGa('G-TEST000000');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await page.api.setBrowserTools(false, true, false, true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(result, { status: result?.status ?? 200 })),
    );
    await page.api.captureSignup();
    expect(page.commands().filter(([c, e]) => c === 'event' && e === 'conversion')).toEqual([]);
  },
);

it.each([
  ['Analytics only', true],
  ['Reject', false],
] as const)(
  '%s immediately withdraws a standard-region default grant without a saved cookie',
  async (_label, isAccepted) => {
    const page = await googleBrowser();
    page.api.initializeGa('G-TEST000000');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await page.api.setBrowserTools(false, true, false, true);
    Object.assign(page.window, { dispatchEvent: () => true });
    const { chooseConsent } = await import('@/components/analytics');
    chooseConsent(isAccepted);
    const { readConsent } = await import('./consent');
    expect(readConsent(document.cookie.match(/er_consent=([^;]+)/)?.[1])).toEqual({
      accepted: isAccepted,
      advertising: false,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ method: 'email' })),
    );
    await page.api.captureSignup();
    expect(page.commands().filter(([c, e]) => c === 'event' && e === 'conversion')).toEqual([]);
    expect(
      page
        .commands()
        .filter(([c, e]) => c === 'consent' && e === 'update')
        .at(-1),
    ).toEqual([
      'consent',
      'update',
      expect.objectContaining({ ad_storage: 'denied', ad_user_data: 'denied' }),
    ]);
  },
);

const campaign = {
  utm_source: 'google',
  utm_medium: 'cpc',
  utm_campaign: 'er_s_es_es_niche',
  utm_content: 'ad-1',
  utm_term: 'product model',
};
const campaignQuery = new URLSearchParams(campaign).toString();

it('adds first-touch UTMs to the pageview emitted inside PostHog init and later events', async () => {
  const page = await googleBrowser();
  page.window.location.search = `?${campaignQuery}&gclid=Click_123&email=private`;
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_localtest');
  const sent: Array<{ properties: Record<string, unknown> }> = [];
  sdk.init.mockImplementationOnce((_key, config) => {
    sent.push(
      config.before_send({
        event: '$pageview',
        properties: {
          $current_url: page.window.location.href,
          utm_source: null,
          utm_medium: null,
          gclid: 'Click_123',
          dclid: 'Click_123',
          gbraid: 'Click_123',
          wbraid: 'Click_123',
          fbclid: 'Click_123',
          email: 'private@example.com',
        },
      }),
    );
    return sdk;
  });
  await page.api.setBrowserTools(true, false);
  expect(sent[0].properties).toMatchObject(campaign);
  expect(JSON.stringify(sent)).not.toMatch(/Click_123|private|gclid|dclid|gbraid|wbraid|fbclid/);
  page.window.location.href = 'https://easyrender.ai/pricing?utm_source=later&utm_medium=organic';
  expect(
    page.api.beforeSend({ event: '$pageview', properties: { utm_source: 'later' } }).properties,
  ).toMatchObject(campaign);
  expect(page.api.beforeSend({ event: 'photo_selected', properties: {} }).properties).toMatchObject(
    campaign,
  );
  expect(sdk.init.mock.calls[0][1]).toMatchObject({
    cookieless_mode: 'always',
    persistence: 'memory',
    disable_persistence: true,
    person_profiles: 'never',
  });
});

it.each([false, true])(
  'keeps UTMs in Google page locations with advertising allowed=%s',
  async (isAllowed) => {
    const page = await googleBrowser();
    page.window.location.search = `?${campaignQuery}&gclid=Click_123&gbraid=Braid_123&wbraid=Web_123&dclid=Display_123&email=private&token=secret&foo=bar`;
    page.api.initializeGa('G-TEST000000');
    await page.api.setBrowserTools(false, true, false, isAllowed);
    const expected = `https://easyrender.ai/credits?${campaignQuery}${isAllowed ? '&gclid=Click_123&dclid=Display_123&gbraid=Braid_123&wbraid=Web_123' : ''}`;
    expect(page.commands()).toContainEqual(['set', { page_location: expected }]);
    expect(page.commands()).toContainEqual([
      'config',
      'G-TEST000000',
      expect.objectContaining({ page_location: expected }),
    ]);
    expect(page.commands()).toContainEqual([
      'event',
      'page_view',
      expect.objectContaining({ page_location: expected }),
    ]);
    expect(JSON.stringify(page.commands())).not.toMatch(/email=|token=|foo=|private|secret/);
  },
);

it.each([
  { userAgent: 'Mozilla/5.0 Chrome/130.0', webdriver: true },
  ...[
    'HeadlessChrome',
    'Playwright',
    'Puppeteer',
    'Selenium',
    'PhantomJS',
    'Googlebot',
    'curl/8.0',
    '',
    '   ',
  ].map((userAgent) => ({ userAgent })),
  {},
])('does not bootstrap analytics for automation %j', async (navigator) => {
  const page = await googleBrowser('easyrender.ai', navigator);
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_localtest');
  sdk.init.mockReturnValueOnce(sdk);
  page.api.initializeGa('G-TEST000000');
  await page.api.setBrowserTools(true, true, false, true);
  page.api.gaPageview();
  expect(sdk.init).not.toHaveBeenCalled();
  expect(page.scripts).toEqual([]);
  expect(page.commands()).toEqual([]);
});

it.each([
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
])('initializes both analytics tools for a normal browser: %s', async (userAgent) => {
  const page = await googleBrowser('easyrender.ai', { userAgent, webdriver: false });
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_localtest');
  sdk.init.mockReturnValueOnce(sdk);
  page.api.initializeGa('G-TEST000000');
  await page.api.setBrowserTools(true, true, false, true);
  expect(sdk.init).toHaveBeenCalledTimes(1);
  expect(page.scripts).toHaveLength(1);
  expect(page.commands()).toContainEqual(['event', 'page_view', expect.any(Object)]);
});

it('keeps the landing campaign in GA page locations after navigation removes query params', async () => {
  const page = await googleBrowser();
  page.window.location.search = `?${campaignQuery}&gclid=Ad_1`;
  page.api.attribution();
  page.window.location.href = 'https://easyrender.ai/pricing';
  page.api.initializeGa('G-TEST000000');
  await page.api.setBrowserTools(false, true);
  expect(page.commands()).toContainEqual([
    'event',
    'page_view',
    expect.objectContaining({
      page_location: `https://easyrender.ai/pricing?${campaignQuery}`,
    }),
  ]);
});
