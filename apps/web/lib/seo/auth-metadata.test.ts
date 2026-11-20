import { createTranslator } from 'next-intl';
import { expect, it, vi } from 'vitest';
import { LOCALES } from '@/i18n/config';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import itMessages from '@/messages/it.json';
import pt from '@/messages/pt.json';

vi.mock('@/lib/actor', () => ({ currentUser: async () => null }));
vi.mock('@/lib/pricing', () => ({ currentPricing: async () => ({}) }));
vi.mock('next/font/local', () => ({ default: () => ({ className: '', variable: '' }) }));
const catalogs = { en, es, fr, de, it: itMessages, pt };
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async ({
    locale,
    namespace,
  }: {
    locale: keyof typeof catalogs;
    namespace: 'Auth';
  }) => createTranslator({ locale, messages: catalogs[locale], namespace }),
}));

import { generateMetadata as signIn } from '@/app/(app)/sign-in/page';
import { generateMetadata as signUp } from '@/app/(app)/sign-up/page';
import { generateMetadata as localized } from '@/app/(marketing)/[lang]/[...path]/page';

it('root auth routes have their own branded titles', async () => {
  expect((await signIn()).title).toBe('Sign in · Easy Render');
  expect((await signUp()).title).toBe('Create account · Easy Render');
});
it.each(LOCALES.filter((locale) => locale !== 'en'))('localizes %s auth titles', async (locale) => {
  for (const path of ['sign-in', 'sign-up']) {
    const result = await localized({
      params: Promise.resolve({ lang: locale, path: [path] }),
      searchParams: Promise.resolve({}),
    });
    expect(String(result.title).length).toBeLessThanOrEqual(60);
    expect(result.title).toBe(
      `${path === 'sign-in' ? catalogs[locale].Auth.metaSignIn : catalogs[locale].Auth.metaSignUp} · Easy Render`,
    );
    expect(result.robots).toMatchObject({ index: false });
  }
});
