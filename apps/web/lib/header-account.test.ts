import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ isSignedIn: false, path: '/' }));
vi.mock('next/server', () => ({ connection: async () => {} }));
vi.mock('next/navigation', () => ({ usePathname: () => session.path }));
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
  'shows a visible dashboard entry for members and sign-in entries for visitors (%s)',
  async (isSignedIn) => {
    session.isSignedIn = isSignedIn;
    session.path = '/';
    const html = renderToStaticMarkup(await SiteHeader());
    const destination = isSignedIn ? '/dashboard' : '/sign-in';
    expect(html.match(new RegExp(`href="${destination}"`, 'g'))).toHaveLength(isSignedIn ? 1 : 2);
    expect(html).toContain('href="/#try"');
    expect(html).toContain(isSignedIn ? '>dashboard</a>' : '>signIn</a>');
    if (isSignedIn) expect(html).not.toContain('href="/sign-in"');
  },
);

it('does not repeat the dashboard action on secondary landings', async () => {
  session.isSignedIn = true;
  session.path = '/pricing';
  const html = renderToStaticMarkup(await SiteHeader());
  // One session entry shared across widths, with no duplicate primary action.
  expect(html.match(/href="\/dashboard"/g)).toHaveLength(1);
  expect(html).not.toContain('href="/sign-in"');
});
