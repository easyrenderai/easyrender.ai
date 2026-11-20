import { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  topup: null as { plan: string | null } | null,
}));

vi.mock('@/lib/actor', () => ({ currentUser: async () => state.user }));
vi.mock('@/lib/header-account', () => ({
  loadHeaderAccount: async (_id: string, locale: string) => ({ label: `account:${locale}` }),
}));
vi.mock('@/lib/pricing', () => ({
  viewerPricing: async () => ({ variant: 'test', currency: 'eur', subject: 'subject-1' }),
  currentTopupPricing: async () => state.topup,
}));

import { GET } from '@/app/api/viewer/route';

const ask = (path = '/api/viewer', cookie = '') =>
  GET(new NextRequest(`https://easyrender.ai${path}`, { headers: cookie ? { cookie } : {} }));

beforeEach(() => {
  state.user = null;
  state.topup = null;
});

it('answers a visitor with their pricing arm and no account, never cacheable', async () => {
  const response = await ask();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({
    signedIn: false,
    account: null,
    pricing: { key: 'eur.test', variant: 'test', subject: 'subject-1' },
    topup: null,
  });
  // A visitor has no remembered pricing key to set.
  expect(response.cookies.get('er_pc')).toBeUndefined();
});

it('answers a member with their header copy in the page language and remembers their key', async () => {
  state.user = { id: 'u1' };
  const response = await ask('/api/viewer?locale=de');
  const body = await response.json();
  expect(body.signedIn).toBe(true);
  expect(body.account).toEqual({ label: 'account:de' });
  expect(response.cookies.get('er_pc')?.value).toBe('eur.test');
  expect(response.cookies.get('er_app_locale')?.value).toBe('de');
});

it('returns a subscriber quote only when the member has a plan', async () => {
  state.user = { id: 'u1' };
  state.topup = { plan: null };
  expect((await (await ask()).json()).topup).toBeNull();
  state.topup = { plan: 'pro' };
  expect((await (await ask()).json()).topup).toEqual({ plan: 'pro' });
});

it('forgets the remembered key once the visitor is signed out and ignores unknown languages', async () => {
  const response = await ask('/api/viewer?locale=xx', 'er_pc=eur.test; er_app_locale=en');
  expect(response.cookies.get('er_pc')?.value).toBe('');
  // An unknown language falls back to English, which the cookie already says: nothing is written.
  expect(response.cookies.get('er_app_locale')).toBeUndefined();
});
