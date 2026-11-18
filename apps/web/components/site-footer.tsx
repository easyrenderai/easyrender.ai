import { getLocale, getTranslations } from 'next-intl/server';
import { BrandMark } from '@/components/brand-mark';
import { SiteLink as Link } from '@/components/site-link';
import { Separator } from '@/components/ui/separator';
import type { Locale } from '@/i18n/config';
import { localizedAuthPath } from '@/lib/app-locale';
import { isPublished, ROUTES } from '@/lib/seo/routes';

// Links stay inside the visitor's language. The only way across is the language picker, which
// links to the equivalent page, which is what hreflang declares (arch doc, section 6).
const COLUMNS = [
  {
    title: 'product',
    links: [
      { hash: '#how-it-works', key: 'howItWorks' },
      { hash: '#try', key: 'try' },
      { route: 'blog', key: 'guides' },
      { route: 'compare', key: 'comparisons' },
      { route: 'author', key: 'editorial' },
      { route: 'ecommerce', key: 'ecommerce' },
      { href: '/hub', key: 'hub' },
      { href: '/explore', key: 'gallery' },
      { route: 'viewer', key: 'viewer' },
      { route: 'converter', key: 'converter' },
      { route: 'pricing', key: 'pricing' },
      { hash: '#faq', key: 'faq' },
    ],
  },
  {
    title: 'developers',
    links: [
      { route: 'mcp', key: 'mcp' },
      { route: 'api', key: 'api' },
      { href: '/connectors', key: 'apiKeys' },
      { route: 'models', key: 'models' },
      { route: 'evals', key: 'evals' },
    ],
  },
  {
    title: 'account',
    links: [
      { href: '/dashboard', key: 'dashboard' },
      { href: '/sign-up', key: 'signUp' },
      { href: '/sign-in', key: 'signIn' },
      { route: 'privacy', key: 'privacy' },
      { route: 'terms', key: 'terms' },
      { route: 'cookies', key: 'cookies' },
    ],
  },
] as const;

type FooterLink = (typeof COLUMNS)[number]['links'][number];

/** The URL of a footer link in this language, or null when that page is not published in it. */
function hrefFor(link: FooterLink, locale: Locale, home: string): string | null {
  if ('hash' in link) return `${home}${link.hash}`;
  if ('href' in link) {
    if (link.href === '/sign-in' || link.href === '/sign-up')
      return localizedAuthPath(locale, link.href);
    return link.href;
  }
  if (link.route === 'mcp' && !isPublished('mcp', locale)) return `${home}#connect`;
  return isPublished(link.route, locale) ? ROUTES[link.route].paths[locale] : null;
}

export async function SiteFooter() {
  const [t, locale] = await Promise.all([getTranslations('Footer'), getLocale()]);
  const home = ROUTES.home.paths[locale as Locale];

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Link
            href={home}
            className="flex min-h-10 items-center gap-2 font-semibold tracking-tight"
          >
            <BrandMark className="size-[1.375rem]" />
            Easy Render
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">{t('tagline')}</p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.title} className="space-y-3">
            <p className="text-sm font-medium">{t(column.title)}</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {column.links.map((link) => {
                const href = hrefFor(link, locale as Locale, home);
                if (!href) return null;
                return (
                  <li key={link.key}>
                    <Link href={href} className="transition-colors hover:text-foreground">
                      {t(`links.${link.key}`)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <Separator />
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <p>{t('copyright')}</p>
        <p>{t('pricesNote')}</p>
      </div>
    </footer>
  );
}
