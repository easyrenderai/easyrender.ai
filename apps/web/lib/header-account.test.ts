import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ isSignedIn: false }));
vi.mock('next/server', () => ({ connection: async () => {} }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('next-intl', () => ({ useLocale: () => 'en' }));
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'en',
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/lib/actor', () => ({
  currentUser: async () => (session.isSignedIn ? { id: 'fixture' } : null),
}));
vi.mock('@/components/locale-switcher', () => ({ LocaleSwitcher: () => null }));

import { SiteHeader } from '@/components/site-header';

it.each([false, true])(
  'keeps account entry available in desktop and phone menus (signed in: %s)',
  async (isSignedIn) => {
    session.isSignedIn = isSignedIn;
    const html = renderToStaticMarkup(await SiteHeader());
    const destination = isSignedIn ? '/account' : '/sign-in';
    expect(html.match(new RegExp(`href="${destination}"`, 'g'))).toHaveLength(2);
    expect(html).toContain('href="/#try"');
    if (isSignedIn) expect(html).not.toContain('href="/sign-in"');
  },
);
