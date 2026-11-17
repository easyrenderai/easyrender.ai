import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  hasAuthFailure: false,
  user: null as { email: string; emailVerified?: boolean } | null,
}));
vi.mock('../auth', () => ({
  auth: () => {
    if (session.hasAuthFailure) throw new Error('Auth unavailable');
    return { api: { getSession: async () => (session.user ? { user: session.user } : null) } };
  },
}));

import { proxy } from '@/proxy';

afterEach(() => {
  session.user = null;
  session.hasAuthFailure = false;
  vi.unstubAllEnvs();
});
describe('admin HTTP access before streaming', () => {
  it('returns an actual 404 to signed-in non-admins', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.test');
    session.user = { email: 'reader@example.test' };
    const response = await proxy(
      new NextRequest('http://localhost:3207/admin/analytics', {
        headers: { cookie: 'better-auth.session_token=local-fixture' },
      }),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('returns an actual 404 to non-admins on the gift credits page', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.test');
    session.user = { email: 'reader@example.test', emailVerified: true };
    const response = await proxy(
      new NextRequest('http://localhost:3207/admin/gift-credits', {
        headers: { cookie: 'better-auth.session_token=local-fixture' },
      }),
    );
    expect(response.status).toBe(404);
  });
  it('redirects anonymous requests with the requested range', async () => {
    const response = await proxy(
      new NextRequest('http://localhost:3207/admin/analytics?period=90d'),
    );
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') as string).searchParams.get('next')).toBe(
      '/admin/analytics?period=90d',
    );
  });
  it('allows only normalized allowlisted accounts without localization', async () => {
    vi.stubEnv('ADMIN_EMAILS', ' ADMIN@example.test ');
    session.user = { email: 'admin@example.test', emailVerified: true };
    const response = await proxy(
      new NextRequest('http://localhost:3207/admin/analytics/revenue', {
        headers: { cookie: 'better-auth.session_token=local-fixture' },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.has('x-middleware-rewrite')).toBe(false);
    expect(response.headers.get('x-middleware-request-x-admin-return')).toBe(
      '/admin/analytics/revenue',
    );
  });
  it('routes an unverified admin to recovery without exposing the dashboard', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.test');
    session.user = { email: 'admin@example.test', emailVerified: false };
    const response = await proxy(
      new NextRequest('http://localhost:3207/admin/analytics?period=90d', {
        headers: { cookie: 'better-auth.session_token=local-fixture' },
      }),
    );
    expect(response.status).toBe(307);
    const target = new URL(response.headers.get('location') as string);
    expect(target.pathname).toBe('/sign-in/admin');
    expect(target.searchParams.get('next')).toBe('/admin/analytics?period=90d');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});

it.each([undefined, 'better-auth.session_token=invalid-fixture'])(
  'redirects safely when auth fails, with cookie %s and PostHog unset',
  async (cookie) => {
    session.hasAuthFailure = true;
    vi.stubEnv('POSTHOG_PROJECT_ID', '');
    vi.stubEnv('POSTHOG_PERSONAL_API_KEY', '');
    const response = await proxy(
      new NextRequest('http://localhost:3207/admin/analytics', {
        headers: cookie ? { cookie } : {},
      }),
    );
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') as string).pathname).toBe('/sign-in');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  },
);
