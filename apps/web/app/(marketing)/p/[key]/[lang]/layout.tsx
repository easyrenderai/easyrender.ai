import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { IntlBoundary } from '@/components/intl-boundary';
import { SiteChrome } from '@/components/site-chrome';
import { isRoutableLocale, ROUTABLE_LOCALES } from '@/i18n/config';

// The language branches of the priced pages, as [lang]/layout is for the others.
export const dynamicParams = false;

export function generateStaticParams() {
  return ROUTABLE_LOCALES.filter((locale) => locale !== 'en').map((lang) => ({ lang }));
}

export default async function PricedLocaleLayout({
  children,
  params,
}: LayoutProps<'/p/[key]/[lang]'>) {
  const { lang } = await params;
  if (!isRoutableLocale(lang) || lang === 'en') notFound();
  setRequestLocale(lang);
  return (
    <IntlBoundary locale={lang}>
      <SiteChrome locale={lang}>{children}</SiteChrome>
    </IntlBoundary>
  );
}
