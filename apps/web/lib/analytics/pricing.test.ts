import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
vi.mock('posthog-js', () => {
  sdk.init.mockReturnValue(sdk);
  return { default: sdk };
});
beforeEach(() => vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Chrome/130.0' }));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('uses the server variant, captures exposure after consent, and stops on withdrawal', async () => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_localtest');
  const location = new URL('https://easyrender.ai/credits');
  vi.stubGlobal('location', location);
  vi.stubGlobal('window', { location });
  vi.stubGlobal('document', {
    cookie: '',
    referrer: '',
    documentElement: { dataset: { pricingVariant: 'test', pricingSubject: 'hashed-subject' } },
    querySelector: () => null,
  });
  const api = await import('./browser');
  api.observePricing('test');
  await api.setBrowserTools(false, false);
  api.captureBrowser('checkout_started');
  expect(sdk.init).not.toHaveBeenCalled();
  expect(sdk.capture).not.toHaveBeenCalled();
  await api.setBrowserTools(true, false);
  api.observePricing('test');
  const exposures = sdk.capture.mock.calls.filter(([event]) => event === 'pricing_viewed');
  expect(exposures).toHaveLength(1);
  expect(exposures[0][1]).toMatchObject({
    pricing_variant: 'test',
    pricing_subject: 'hashed-subject',
    '$feature/pricing-test-2026-11': 'test',
  });
  api.captureBrowser('checkout_started', { value: 10, currency: 'USD' });
  expect(sdk.capture.mock.lastCall).toEqual([
    'checkout_started',
    expect.objectContaining({ pricing_variant: 'test', value: 10, currency: 'USD' }),
  ]);
  const calls = sdk.capture.mock.calls.length;
  await api.setBrowserTools(false, false, true);
  api.captureBrowser('checkout_started');
  expect(sdk.capture).toHaveBeenCalledTimes(calls);
  expect(sdk.init).toHaveBeenCalledTimes(1);
  expect(sdk.init.mock.calls[0][1]).toMatchObject({
    cookieless_mode: 'always',
    persistence: 'memory',
    advanced_disable_feature_flags: true,
  });
});

it('initializes one SDK when consent effects race', async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_localtest');
  const location = new URL('https://easyrender.ai/credits');
  vi.stubGlobal('location', location);
  vi.stubGlobal('window', { location });
  vi.stubGlobal('document', { cookie: '', referrer: '', querySelector: () => null });
  const api = await import('./browser');
  await Promise.all([api.setBrowserTools(true, false), api.setBrowserTools(true, false)]);
  expect(sdk.init).toHaveBeenCalledTimes(1);
});

it('keeps editorial CTA attribution on product events without overwriting their source or acquisition campaign', async () => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_localtest');
  const location = new URL('https://easyrender.ai/es/comparativas/meshy?utm_source=directory');
  vi.stubGlobal('location', location);
  vi.stubGlobal('window', { location });
  vi.stubGlobal('document', { cookie: '', referrer: '', querySelector: () => null });
  const api = await import('./browser');
  const cta = {
    article_group: 'compare-meshy',
    article_locale: 'es',
    article_path: '/es/comparativas/meshy',
    cta_position: 'sidebar',
    cta_destination: '/es#try',
  } as const;
  api.articleMetrics.visibility(cta, true);
  await api.setBrowserTools(true, false);
  api.articleMetrics.click(cta);
  location.pathname = '/es';
  api.captureBrowser('render_preview_created', { source: 'home' });
  expect(sdk.capture.mock.lastCall).toEqual([
    'render_preview_created',
    expect.objectContaining({ ...cta, source: 'home' }),
  ]);
  expect(api.attribution()?.utm_source).toBe('directory');
  expect(sdk.capture.mock.calls.filter(([event]) => event === 'article_cta_viewed')).toHaveLength(
    1,
  );
});
