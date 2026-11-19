import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  isSignedIn: false,
  path: '/',
  balance: 120 as number | 'throw',
}));
vi.mock('next/server', () => ({ connection: async () => {} }));
vi.mock('next/navigation', () => ({ usePathname: () => session.path }));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}));
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'en',
  getTranslations: async () => (key: string, values?: { count?: number }) =>
    typeof values?.count === 'number' ? `${key}:${values.count}` : key,
  getFormatter: async () => ({ number: (value: number) => String(value) }),
}));
vi.mock('@/lib/actor', () => ({
  currentUser: async () => (session.isSignedIn ? { id: 'fixture' } : null),
}));
vi.mock('@easyrender/core', () => ({
  getBalance: async () => {
    if (session.balance === 'throw') throw new Error('database');
    return session.balance;
  },
  getDashboardStats: async () => ({ total: 0, ready: 0, inFlight: 0, byAgent: 0 }),
  listRenders: async () => [],
}));
vi.mock('@/components/locale-switcher', () => ({ LocaleSwitcher: () => null }));
vi.mock('@/components/app-locale-picker', () => ({ AppLocalePicker: () => null }));
vi.mock('react-resizable-panels', () => ({
  useDefaultLayout: () => ({ defaultLayout: undefined, onLayoutChanged: () => {} }),
  usePanelRef: () => ({ current: null }),
}));

import { AppShell } from '@/components/app-shell/app-shell';
import type { ShellData } from '@/components/app-shell/types';
import { SiteHeader } from '@/components/site-header';

const shell: ShellData = {
  email: 'a@example.com',
  name: 'A',
  stats: { total: 0, ready: 0, inFlight: 0, byAgent: 0 },
  renders: [],
  now: 0,
};

it.each([false, true])(
  'shows a visible dashboard entry for members and sign-in entries for visitors (%s)',
  async (isSignedIn) => {
    session.isSignedIn = isSignedIn;
    session.balance = 120;
    session.path = '/';
    const html = renderToStaticMarkup(await SiteHeader());
    const destination = isSignedIn ? '/dashboard' : '/sign-in';
    expect(html.match(new RegExp(`href="${destination}"`, 'g'))).toHaveLength(isSignedIn ? 1 : 2);
    expect(html).toContain('href="/#try"');
    expect(html).toContain(isSignedIn ? '>dashboard</a>' : '>signIn</a>');
    if (isSignedIn) {
      expect(html).not.toContain('href="/sign-in"');
      expect(html).toContain('aria-label="account, creditsBalance:120"');
      expect(html.match(/href="\/credits"/g)).toHaveLength(2);
      expect(html).toContain('data-slot="header-credits"');
    } else {
      expect(html).not.toContain('href="/credits"');
      expect(html).not.toContain('data-slot="account-menu"');
    }
  },
);

it('does not repeat the dashboard action on secondary landings', async () => {
  session.isSignedIn = true;
  session.balance = 120;
  session.path = '/pricing';
  const html = renderToStaticMarkup(await SiteHeader());
  // One session entry shared across widths, with no duplicate primary action.
  expect(html.match(/href="\/dashboard"/g)).toHaveLength(1);
  expect(html).not.toContain('href="/sign-in"');
  expect(html).toContain('creditsBalance:120');
});

it('hides the balance when the read fails and keeps the credits link', async () => {
  session.isSignedIn = true;
  session.balance = 'throw';
  session.path = '/hub';
  const html = renderToStaticMarkup(await SiteHeader());
  expect(html).toContain('data-slot="account-menu"');
  expect(html).toContain('aria-label="account"');
  expect(html).not.toContain('creditsBalance');
  expect(html).toContain('aria-label="creditsLink"');
  expect(html).not.toContain('database');
  expect(html).not.toContain('role="alert"');
});

it('shows a zero balance', async () => {
  session.isSignedIn = true;
  session.balance = 0;
  session.path = '/hub';
  const html = renderToStaticMarkup(await SiteHeader());
  expect(html).toContain('aria-label="account, creditsBalance:0"');
});

it('places the account control in the signed-in app header', () => {
  session.path = '/dashboard';
  const html = renderToStaticMarkup(
    createElement(
      AppShell as (props: {
        data: ShellData;
        account?: ReactNode;
        children?: ReactNode;
      }) => ReactNode,
      {
        data: shell,
        account: createElement('a', { href: '/credits' }, '120 credits'),
      },
      createElement('p', null, 'Overview'),
    ),
  );
  expect(html).toContain('href="/credits"');
  expect(html).toContain('120 credits');
  expect(html).toContain('Overview');
});
