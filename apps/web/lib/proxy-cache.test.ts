import { NextRequest } from 'next/server';
import { afterEach, expect, it, vi } from 'vitest';
import { proxy } from '@/proxy';

// What proxy.ts does to a request in front of the edge cache: pick the page built for the visitor,
// and add nothing to a cacheable response that would stop the CDN from keeping it.

const request = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`https://easyrender.ai${path}`, {
    headers: {
      accept: 'text/html',
      'sec-fetch-dest': 'document',
      'user-agent': 'curl/8.0',
      ...headers,
    },
  });
const rewrite = (response: Response) => response.headers.get('x-middleware-rewrite');

afterEach(() => vi.unstubAllEnvs());

it('rewrites a priced page to the build for the visitor country, with no cookie at all', async () => {
  for (const [country, key] of [
    ['DE', 'eur.control'],
    ['US', 'usd.control'],
    [undefined, 'usd.control'],
  ] as const) {
    const response = await proxy(
      request('/pricing', country ? { 'x-vercel-ip-country': country } : {}),
    );
    expect(rewrite(response), String(country)).toBe(`https://easyrender.ai/p/${key}/pricing`);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('cache-control')).toBeNull();
  }
  expect(rewrite(await proxy(request('/', { 'x-vercel-ip-country': 'FR' })))).toBe(
    'https://easyrender.ai/p/eur.control',
  );
  expect(rewrite(await proxy(request('/de/preise')))).toBe(
    'https://easyrender.ai/p/usd.control/de/preise',
  );
});

it('keeps the euro kill switch', async () => {
  vi.stubEnv('EUR_CHECKOUT_DISABLED', '1');
  const response = await proxy(request('/pricing', { 'x-vercel-ip-country': 'DE' }));
  expect(rewrite(response)).toBe('https://easyrender.ai/p/usd.control/pricing');
});

it('uses the key a signed-in buyer was given, over the country', async () => {
  const response = await proxy(
    request('/pricing', { 'x-vercel-ip-country': 'US', cookie: 'er_pc=eur.test' }),
  );
  expect(rewrite(response)).toBe('https://easyrender.ai/p/eur.test/pricing');
  const forged = await proxy(
    request('/pricing', { 'x-vercel-ip-country': 'US', cookie: 'er_pc=gbp.control' }),
  );
  expect(rewrite(forged)).toBe('https://easyrender.ai/p/usd.control/pricing');
});

it('sets no cookie and no no-store on a cacheable page that quotes nothing', async () => {
  for (const path of ['/mcp', '/learn', '/es/guias', '/3d-viewer', '/de/preise-nope']) {
    const response = await proxy(request(path));
    expect(rewrite(response), path).toBeNull();
    expect(response.headers.get('set-cookie'), path).toBeNull();
    expect(response.headers.get('cache-control'), path).toBeNull();
  }
});

it('still gives the app and the API an anonymous id and keeps them private', async () => {
  const app = await proxy(request('/dashboard'));
  expect(app.cookies.get('er_anon')?.value).toBeTruthy();
  expect(app.headers.get('cache-control')).toBe('private, no-store');
  const api = await proxy(request('/api/renders'));
  expect(api.cookies.get('er_anon')?.value).toBeTruthy();
});

it('never serves the internal path of a priced page', async () => {
  const response = await proxy(request('/p/usd.control/pricing?utm_source=x'));
  expect(response.status).toBe(308);
  expect(response.headers.get('location')).toBe('https://easyrender.ai/pricing?utm_source=x');
});

it('mints the anonymous id on a priced page only while the experiment is live', async () => {
  vi.stubEnv('PRICING_AB_ENABLED', '1');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
  vi.stubEnv('POSTHOG_PERSONAL_API_KEY', 'phx_test');
  vi.stubEnv('POSTHOG_PROJECT_ID', '1');
  const flag = {
    key: 'pricing-test-2026-11',
    active: true,
    filters: {
      groups: [{ properties: [], rollout_percentage: 100 }],
      multivariate: {
        variants: [
          { key: 'control', rollout_percentage: 0 },
          { key: 'test', rollout_percentage: 100 },
        ],
      },
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ results: [flag] })),
  );
  const first = await proxy(request('/pricing', { 'x-vercel-ip-country': 'DE' }));
  expect(first.cookies.get('er_anon')?.value).toBeTruthy();
  expect(rewrite(first)).toBe('https://easyrender.ai/p/eur.test/pricing');
  // A guide still carries nothing, experiment or not.
  const guide = await proxy(request('/learn'));
  expect(guide.headers.get('set-cookie')).toBeNull();
  vi.unstubAllGlobals();
});

const acquisition =
  'utm_source=google&utm_medium=cpc&utm_campaign=niche&utm_content=ad&utm_term=3d+model&gclid=Ad_1&dclid=Ad_2&gbraid=Ad_3&wbraid=Ad_4';
it.each(['es', 'fr', 'de', 'it', 'pt'] as const)(
  'preserves attribution through the %s home 307',
  async (locale) => {
    for (const method of ['GET', 'HEAD']) {
      const response = await proxy(
        new NextRequest(`https://easyrender.ai/?${acquisition}`, {
          method,
          headers: {
            'user-agent': 'Mozilla/5.0 Chrome/130.0',
            'x-vercel-ip-country': locale.toUpperCase(),
          },
        }),
      );
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        `https://easyrender.ai/${locale}?${acquisition}`,
      );
    }
  },
);
it.each([
  ['www.easyrender.ai', '/'],
  ['easyrenderai.vercel.app', '/'],
  ['easyrender-landing.vercel.app', '/es'],
])('preserves attribution through the canonical-host 301 from %s', async (host, path) => {
  vi.stubEnv('VERCEL_ENV', 'production');
  const response = await proxy(
    new NextRequest(`https://${host}/?${acquisition}`, { headers: { host } }),
  );
  expect(response.status).toBe(301);
  expect(response.headers.get('location')).toBe(`https://easyrender.ai${path}?${acquisition}`);
});
it('preserves attribution through the public pricing-path 308', async () => {
  const response = await proxy(request(`/p/usd.control/pricing?${acquisition}`));
  expect(response.status).toBe(308);
  expect(response.headers.get('location')).toBe(`https://easyrender.ai/pricing?${acquisition}`);
});

it.each(['es', 'fr', 'de', 'it', 'pt'] as const)(
  'preserves attribution through a legacy %s guide alias',
  async (locale) => {
    const { listPosts } = await import('@/lib/blog/posts');
    const { guideAlias } = await import('@/lib/guide-alias');
    const post = listPosts('en').find((post) => guideAlias(locale, post.slug));
    expect(post).toBeDefined();
    const response = await proxy(request(`/${locale}/learn/${post?.slug}?${acquisition}`));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      `https://easyrender.ai${guideAlias(locale, post?.slug ?? '')}?${acquisition}`,
    );
  },
);
