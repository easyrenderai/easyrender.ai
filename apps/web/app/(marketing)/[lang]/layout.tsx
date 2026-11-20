import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { IntlBoundary } from '@/components/intl-boundary';
import { SiteChrome } from '@/components/site-chrome';
import { isRoutableLocale, ROUTABLE_LOCALES } from '@/i18n/config';

// The non-English branches of the tree. English is at the root, so /en is not a URL: serving the
// same page twice would be the canibalisation hreflang exists to prevent.
//
// dynamicParams = false turns anything outside this list into a 404, which is the rule from the
// architecture: a language URL without approved copy does not exist. Opening a language means
// adding its messages file and its entry in ROUTABLE_LOCALES, and nothing else.
//
// The pages here quote no money (the home, pricing, models, ecommerce and API pages do, and live
// under p/[key]). The language comes from the URL, so nothing reads the request: built once, served
// from the edge cache.
export const dynamicParams = false;

// Rebuilt at most hourly: a guide's publication date passing must show without a deploy.
export const revalidate = 3600;

export function generateStaticParams() {
  return ROUTABLE_LOCALES.filter((locale) => locale !== 'en').map((lang) => ({ lang }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isRoutableLocale(lang) || lang === 'en') notFound();
  setRequestLocale(lang);
  return (
    <IntlBoundary locale={lang}>
      <SiteChrome locale={lang}>{children}</SiteChrome>
    </IntlBoundary>
  );
}
