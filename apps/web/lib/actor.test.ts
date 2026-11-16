import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));
vi.mock('next/headers', () => ({ headers: async () => requestHeaders.current }));
vi.mock('./auth', () => ({
  auth: () => ({ api: { getSession: async () => ({ user: { id: 'user-1' } }) } }),
}));
vi.mock('@/lib/analytics/privacy-region', () => ({ privacyRegion: () => ({ country: 'ES' }) }));
vi.mock('@easyrender/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@easyrender/core')>()),
  verifyApiKeyPrincipal: vi.fn(async () => null),
  consumeApiRateLimit: vi.fn(async () => undefined),
}));

import { AppError } from '@easyrender/core';
import { resolveActor, resolveViewerActor } from './actor';

beforeEach(() => {
  requestHeaders.current = new Headers({ authorization: 'Bearer er_expired' });
});

it('still rejects a bad API key for API routes', async () => {
  await expect(resolveActor()).rejects.toBeInstanceOf(AppError);
});

it('shows a page to the signed-in visitor when the request carries a bad API key', async () => {
  const actor = await resolveViewerActor();
  expect(actor).toMatchObject({ userId: 'user-1', source: 'web', geoCountry: 'ES' });
  expect(actor.apiKeyId).toBeUndefined();
});
