import { getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/brand-mark';
import {
  HeaderAccount,
  HeaderMenuCredits,
  HeaderMenuSignIn,
  HeaderSession,
} from '@/components/header-viewer';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { HeaderConnect, HeaderNavItem } from '@/components/site-header-links';
import { SiteLink as Link } from '@/components/site-link';
import { SiteMenu } from '@/components/site-menu';
import type { Locale } from '@/i18n/config';
import { localizedAuthPath } from '@/lib/app-locale';
import { isPublished, ROUTES } from '@/lib/seo/routes';
import { siteNavigation } from '@/lib/site-navigation';

// The same HTML for every visitor of a language, so the edge can cache the page around it. What
// depends on who is looking (Dashboard or Sign in, the balance pill) is in components/header-viewer
// and fills in when /api/viewer answers.
export async function SiteHeader({ locale }: { locale: Locale }) {
  const [t, apiT] = await Promise.all([
    getTranslations({ locale, namespace: 'Header' }),
    getTranslations({ locale, namespace: 'ApiLanding' }),
  ]);
  const home = ROUTES.home.paths[locale];
  const signIn = localizedAuthPath(locale, '/sign-in');
  const nav = siteNavigation(locale);
  // Pricing falls back to the home anchor; unpublished integration pages are filtered above.
  const navHref = (item: (typeof nav)[number]) => {
    if ('href' in item) return item.href;
    if ('route' in item)
      return isPublished(item.route, locale) ? ROUTES[item.route].paths[locale] : `${home}#pricing`;
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
                locale={locale}
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
          <HeaderSession
            dashboardLabel={t('dashboard')}
            signInLabel={t('signIn')}
            signInHref={signIn}
          />
          <HeaderConnect
            locale={locale}
            connect={t('connect')}
            suffix={t('connectSuffix')}
            apiLabel={apiT('headerCta')}
            uploadLabel={t('upload')}
          />
          <HeaderAccount />
          <SiteMenu openLabel={t('menuOpen')} closeLabel={t('menuClose')}>
            <HeaderMenuCredits />
            <nav aria-label={t('sections')} className="flex flex-col">
              {nav.map((item) => (
                <HeaderNavItem
                  key={item.key}
                  locale={locale}
                  href={navHref(item)}
                  hash={'hash' in item ? item.hash : undefined}
                  isMobile
                >
                  {t(`nav.${item.key}`)}
                </HeaderNavItem>
              ))}
            </nav>
            {/* Members already have Dashboard in the phone's visible header row. */}
            <HeaderMenuSignIn label={t('signIn')} href={signIn} />
          </SiteMenu>
        </div>
      </div>
    </header>
  );
}
