import { connection } from 'next/server';
import { getLocale, getTranslations } from 'next-intl/server';
import { AccountCreditsLink, AccountMenu } from '@/components/account-menu';
import { BrandMark } from '@/components/brand-mark';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { HeaderConnect, HeaderNavItem } from '@/components/site-header-links';
import { SiteLink as Link } from '@/components/site-link';
import { SiteMenu } from '@/components/site-menu';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';
import { localizedAuthPath } from '@/lib/app-locale';
import { loadHeaderAccount } from '@/lib/header-account';
import { isPublished, ROUTES } from '@/lib/seo/routes';
import { siteNavigation } from '@/lib/site-navigation';

export async function SiteHeader() {
  // Per-request: the header reads the session, so no page (404 included) is prerendered against the database.
  await connection();
  const user = await currentUser().catch(() => null);
  const [t, locale, apiT, account] = await Promise.all([
    getTranslations('Header'),
    getLocale(),
    getTranslations('ApiLanding'),
    user ? loadHeaderAccount(user.id) : Promise.resolve(null),
  ]);
  const home = ROUTES.home.paths[locale as Locale];
  const signIn = localizedAuthPath(locale, '/sign-in');
  const nav = siteNavigation(locale as Locale);
  // Pricing falls back to the home anchor; unpublished integration pages are filtered above.
  const navHref = (item: (typeof nav)[number]) => {
    if ('href' in item) return item.href;
    if ('route' in item)
      return isPublished(item.route, locale as Locale)
        ? ROUTES[item.route].paths[locale as Locale]
        : `${home}#pricing`;
    return `${home}${item.hash}`;
  };
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* One row at every width: members always see Dashboard; visitors find sign-in
          in the phone menu. Section links appear from xl. */}
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href={home}
            className="-ml-2 flex min-h-10 min-w-10 shrink-0 items-center gap-2 px-2 font-semibold tracking-tight"
          >
            <BrandMark className="size-[1.375rem]" />
            {/* Icon only on the narrowest phones so the header actions still fit. */}
            <span className="max-[400px]:sr-only">Easy Render</span>
          </Link>
          <nav aria-label={t('sections')} className="hidden items-center gap-1 xl:flex">
            {nav.map((item) => (
              <HeaderNavItem
                key={item.key}
                locale={locale as Locale}
                href={navHref(item)}
                hash={'hash' in item ? item.hash : undefined}
              >
                {t(`nav.${item.key}`)}
              </HeaderNavItem>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <LocaleSwitcher />
          <Button variant="ghost" size="sm" className={user ? undefined : 'max-sm:hidden'} asChild>
            <Link href={user ? '/dashboard' : signIn}>{t(user ? 'dashboard' : 'signIn')}</Link>
          </Button>
          <HeaderConnect
            locale={locale as Locale}
            connect={t('connect')}
            suffix={t('connectSuffix')}
            apiLabel={apiT('headerCta')}
            uploadLabel={t('upload')}
            isSignedIn={Boolean(user)}
          />
          {account ? <AccountMenu placement="marketing" copy={account} /> : null}
          <SiteMenu openLabel={t('menuOpen')} closeLabel={t('menuClose')}>
            {account ? (
              <AccountCreditsLink
                label={account.balanceLabel ?? account.creditsLinkLabel}
                className="sm:hidden"
              />
            ) : null}
            <nav aria-label={t('sections')} className="flex flex-col">
              {nav.map((item) => (
                <HeaderNavItem
                  key={item.key}
                  locale={locale as Locale}
                  href={navHref(item)}
                  hash={'hash' in item ? item.hash : undefined}
                  isMobile
                >
                  {t(`nav.${item.key}`)}
                </HeaderNavItem>
              ))}
            </nav>
            {/* Members already have Dashboard in the phone's visible header row. */}
            {!user ? (
              <Button variant="outline" className="mt-2 sm:hidden" asChild>
                <Link href={signIn}>{t('signIn')}</Link>
              </Button>
            ) : null}
          </SiteMenu>
        </div>
      </div>
    </header>
  );
}
