import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Analytics } from '@/components/analytics';
import { DocumentLanguage } from '@/components/document-language';
import { HTML_LANG, type Locale } from '@/i18n/config';
import { pickClientMessages } from '@/lib/client-messages';

/**
 * The translations of one part of the site, for server and browser components alike. The root layout
 * cannot hold them: it sits above every route and knows no language, which is what lets it be built
 * once. Each group of routes puts one of these in its layout.
 *
 * With a `locale` (a marketing page, whose language is in its URL) nothing is read from the request,
 * so the page can be cached. Without one (the app, sign in, the 404) the language follows the request.
 */
export async function IntlBoundary({
  locale,
  isFallback = false,
  children,
}: {
  locale?: Locale;
  /**
   * For the 404 page. A not-found file is drawn alongside every page of the tree, not only when it
   * is needed, so it must not make its language the language of the request: it would overwrite the
   * page's own and Spanish pages would come out in English.
   */
  isFallback?: boolean;
  children: ReactNode;
}) {
  if (locale && !isFallback) setRequestLocale(locale);
  const resolved = locale ?? ((await getLocale()) as Locale);
  const messages = await getMessages({ locale: resolved });
  return (
    <NextIntlClientProvider locale={resolved} messages={pickClientMessages(messages)}>
      {locale ? null : <FollowRequestLanguage locale={resolved} />}
      {children}
      <Analytics />
    </NextIntlClientProvider>
  );
}

// The root layout writes <html lang> from the URL, which has no language on the app's pages. This
// sets it from the request before the first paint, as the root layout did when it read the request.
function FollowRequestLanguage({ locale }: { locale: Locale }) {
  if (locale === 'en') return <DocumentLanguage lang={HTML_LANG.en} />;
  return (
    <>
      <DocumentLanguage lang={HTML_LANG[locale]} />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: a constant from the HTML_LANG table.
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(HTML_LANG[locale])}`,
        }}
      />
    </>
  );
}
