import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ status: vi.fn() }));
vi.mock('@easyrender/core', () => ({ mailingStatus: mocks.status }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'en' }));

import { MailingPreferences } from '@/components/mailing-preferences';

beforeEach(() => {
  mocks.status.mockResolvedValue({
    status: 'active',
    locale: 'es',
    expiresAt: '2099-01-01T00:00:00Z',
    isAvailable: false,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it('does not query the unmigrated mailing schema in previews or local development', async () => {
  for (const environment of ['preview', 'development', '']) {
    vi.stubEnv('VERCEL_ENV', environment);
    expect(await MailingPreferences({ userId: 'test-user' })).toBeNull();
  }
  expect(mocks.status).not.toHaveBeenCalled();
});
it('preserves production unsubscribe controls while sending is disabled', async () => {
  vi.stubEnv('VERCEL_ENV', 'production');
  const element = await MailingPreferences({ userId: 'test-user' });
  expect(element).not.toBeNull();
  const html = renderToStaticMarkup(element ?? createElement('div'));
  expect(html).toContain('Stop these emails');
  expect(html).not.toContain('role="switch"');
});
