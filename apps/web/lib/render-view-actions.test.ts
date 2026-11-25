import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/r/preview',
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useFormatter: () => ({ number: String, dateTime: String }),
  useTranslations: () =>
    Object.assign((key: string) => key, { rich: (key: string) => key, has: () => true }),
}));
vi.mock('@/lib/analytics/browser', () => ({
  captureBrowser: vi.fn(),
  observeRender: vi.fn(),
  attribution: () => ({}),
  attributionHeaders: () => ({}),
  captureSignup: vi.fn(),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: {} }));
vi.mock('@/components/analytics', () => ({ cookiesPath: () => '/cookies' }));
vi.mock('@/components/use-viewer', () => ({ useViewer: () => ({ data: undefined }) }));
// The first-model offer is a query; here it has resolved to "no offer", so the paid build action shows.
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => ({
    data: null,
    isSuccess: true,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/components/purchase-conversion', () => ({ PurchaseConversion: () => null }));
vi.mock('@/components/render-detail', () => ({
  DATE_FORMAT: {},
  RenderDetail: ({ actions }: { actions?: React.ReactNode }) =>
    createElement('div', { 'data-actions': true }, actions),
}));

import { RenderView } from '@/components/render-view';

const preview = {
  id: 'preview',
  status: 'preview_ready',
  prompt: null,
  name: null,
  error: null,
  hasPreview: true,
  hasSheet: true,
  sheetNote: null,
  hasModel: false,
  modelVersion: 1,
  credits: 0,
  renderCredits: 80,
  qualityCredits: { low: 80, medium: 140, high: 200 },
  buildQuality: 'low',
  rebuildRefundCredits: 0,
  sheetCredits: 50,
  upscaleCredits: 10,
  canUpscale: false,
  isPublic: false,
  source: 'web',
  createdAt: '2026-11-25T00:00:00.000Z',
} as const;

const packs = {
  variant: 'control',
  rate: { plan: null, variant: 'control', currency: 'usd', priceCents: 1, creditsPerUnit: 1 },
} as const;

function markup(isSignedIn: boolean, balance = 0, options: { hasPacks?: boolean } = {}) {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(RenderView, {
        initial: { ...preview },
        edits: [],
        now: 0,
        signedIn: isSignedIn,
        balance,
        owner: true,
        ...(options.hasPacks ? { packs } : {}),
      }),
    ),
  );
}

it('offers saving a finished anonymous preview, with building behind the same panel', () => {
  const html = markup(false);
  expect(html).toContain('gate.save');
  expect(html).toContain('render3d');
  // Neither action leaves the page for a sign-up route: both open the panel.
  expect(html).not.toContain('/sign-up');
});

it('does not ask a signed-in owner to save their own preview', () => {
  expect(markup(true)).not.toContain('gate.save');
});

it('opens the credit packs in place when the balance is short for the build', () => {
  const html = markup(true, 10, { hasPacks: true });
  expect(html).toContain('addCreditsToBuild');
  expect(html).toContain('aria-expanded="false"');
  expect(html).not.toContain('/credits?next');
  // Nothing is charged or opened until the button is pressed.
  expect(html).not.toContain('id="build-packs"');
});

it('links to Credits when the packs could not be loaded', () => {
  const html = markup(true, 10);
  expect(html).toContain('buyToRender');
  expect(html).toContain('/credits?next');
});

it('builds as before when the balance covers the quote', () => {
  const html = markup(true, 500, { hasPacks: true });
  expect(html).toContain('render3d');
  expect(html).not.toContain('addCreditsToBuild');
});

it('tells the owner what happened after paying, from the confirmed purchase only', () => {
  const confirmed = { issued_credits: 1000 } as never;
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(RenderView, {
        initial: { ...preview },
        edits: [],
        now: 0,
        signedIn: true,
        balance: 1000,
        owner: true,
        checkout: { status: 'success', sessionId: 'cs_test_1', confirmed },
      }),
    ),
  );
  expect(html).toContain('purchase.confirmed');
});
