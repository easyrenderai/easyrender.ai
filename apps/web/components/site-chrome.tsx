import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import type { Locale } from '@/i18n/config';

// The marketing frame: the site header and footer around a page. The signed-in app does not use
// it, it has its own shell (components/app-shell). Both sit under the same root layout, which
// holds the fonts and the query client; the translations come from the IntlBoundary of the group.
// A page with a fixed language passes it, so nothing here reads the request and the page can be
// cached; the sign-in pages and the 404 let it follow the request.
export async function SiteChrome({ locale, children }: { locale?: Locale; children: ReactNode }) {
  const resolved = locale ?? ((await getLocale()) as Locale);
  return (
    <>
      <SiteHeader locale={resolved} />
      <main className="flex-1">{children}</main>
      <SiteFooter locale={resolved} />
    </>
  );
}
