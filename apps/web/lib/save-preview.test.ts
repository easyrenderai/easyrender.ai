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

function markup(isSignedIn: boolean) {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(RenderView, {
        initial: { ...preview },
        edits: [],
        now: 0,
        signedIn: isSignedIn,
        balance: 0,
        owner: true,
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
