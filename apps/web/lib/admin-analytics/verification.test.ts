import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminVerification } from '@/components/admin-verification';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

const fixture = vi.hoisted(() => ({
  hasGoogleAccount: false,
  user: null as { email: string; emailVerified?: boolean } | null,
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
  notFound: () => {
    throw new Error('notFound');
  },
}));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'en' }));
vi.mock('@/lib/admin-analytics/session', () => ({
  adminSession: async () => (fixture.user ? { user: fixture.user } : null),
}));
vi.mock('@easyrender/db', () => ({
  db: () => ({
    account: { findFirst: async () => (fixture.hasGoogleAccount ? { id: 'local-google' } : null) },
  }),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: {} }));

import AdminVerificationPage from '@/app/(app)/sign-in/admin/page';

afterEach(() => {
  fixture.user = null;
  fixture.hasGoogleAccount = false;
  vi.unstubAllEnvs();
});

it.each([en, es])('explains verification and offers Google and account recovery', (messages) => {
  const html = renderToStaticMarkup(
    createElement(AdminVerification, {
      email: 'admin@example.test',
      next: '/admin/analytics?period=90d',
      locale: 'en',
      hasGoogleAccount: false,
      isGoogleAvailable: true,
      hasOAuthError: true,
      copy: messages.AuthService.adminAccess,
    }),
  );
  expect(html).toContain(messages.AuthService.adminAccess.title);
  expect(html).toContain(messages.AuthService.adminAccess.google);
  expect(html).toContain('admin@example.test');
  expect(html).toContain('href="/account"');
  expect(html).toContain('role="alert"');
  expect(html).not.toContain('type="password"');
});

it('offers account verification when Google is not configured', () => {
  const html = renderToStaticMarkup(
    createElement(AdminVerification, {
      email: 'admin@example.test',
      next: '/admin/analytics',
      locale: 'en',
      hasGoogleAccount: false,
      isGoogleAvailable: false,
      hasOAuthError: false,
      copy: en.AuthService.adminAccess,
    }),
  );
  expect(html).toContain(en.AuthService.adminAccess.googleUnavailable);
  expect(html).not.toContain('<button');
});

it.each([
  null,
  { email: 'reader@example.test', emailVerified: false },
  { email: 'reader@example.test', emailVerified: true },
])('protects the recovery page from non-admin sessions', async (user) => {
  fixture.user = user;
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.test');
  await expect(AdminVerificationPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    user ? 'notFound' : 'redirect:/sign-in?next=',
  );
});

it('returns a verified admin to the original report instead of looping', async () => {
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.test');
  fixture.user = { email: 'admin@example.test', emailVerified: true };
  await expect(
    AdminVerificationPage({
      searchParams: Promise.resolve({ next: '/admin/analytics?period=90d' }),
    }),
  ).rejects.toThrow('redirect:/admin/analytics?period=90d');
});

it('shows recovery only for an unverified allowlisted session', async () => {
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.test');
  fixture.user = { email: 'admin@example.test', emailVerified: false };
  const page = await AdminVerificationPage({ searchParams: Promise.resolve({ locale: 'es' }) });
  expect(renderToStaticMarkup(page)).toContain(es.AuthService.adminAccess.title);
});

it('shows the recovery error when Google returns its own OAuth error code', async () => {
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.test');
  fixture.user = { email: 'admin@example.test', emailVerified: false };
  const page = await AdminVerificationPage({
    searchParams: Promise.resolve({ error: 'access_denied' }),
  });
  expect(renderToStaticMarkup(page)).toContain(en.AuthService.adminAccess.error);
});

it('offers verification sign-in after the server confirms Google is linked', async () => {
  vi.stubEnv('ADMIN_EMAILS', 'admin@example.test');
  vi.stubEnv('GOOGLE_CLIENT_ID', 'local-client');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'local-secret');
  fixture.user = { email: 'admin@example.test', emailVerified: false };
  fixture.hasGoogleAccount = true;
  const page = await AdminVerificationPage({ searchParams: Promise.resolve({ locale: 'es' }) });
  const html = renderToStaticMarkup(page);
  expect(html).toContain(es.AuthService.adminAccess.verifyGoogle);
  expect(html).toContain(es.AuthService.adminAccess.linkedInstructions);
});
