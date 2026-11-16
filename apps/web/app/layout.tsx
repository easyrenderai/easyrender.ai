import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Analytics } from '@/components/analytics';
import { HTML_LANG, type Locale, PATH_HEADER } from '@/i18n/config';
import { pickClientMessages } from '@/lib/client-messages';
import { geistMono, geistSans } from '@/lib/fonts';
import { GOOGLE_TAG_BOOTSTRAP } from '@/lib/google-tag';
import { isMailingTokenLocation } from '@/lib/mailing-privacy';
import { currentPricing } from '@/lib/pricing';
import { SITE_URL } from '@/lib/seo/site';
import './globals.css';

// metadataBase makes every relative canonical, Open Graph and sitemap URL absolute against the
// canonical origin, so a preview deployment never emits its own host in an indexable tag.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    metadataBase: new URL(SITE_URL),
    title: t('title'),
    description: t('description'),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, messages, requestHeaders] = await Promise.all([
    getLocale(),
    getMessages(),
    headers(),
  ]);
  // The Shopify app's page runs inside the Shopify admin, which needs App Bridge loaded first in the head.
  const pricing = await currentPricing();
  const isShopifyApp = requestHeaders.get(PATH_HEADER) === '/shopify';
  const isEmailTokenPage = isMailingTokenLocation(requestHeaders.get(PATH_HEADER) ?? '');
  return (
    <html
      lang={HTML_LANG[locale as Locale]}
      data-pricing-variant={pricing.variant}
      data-pricing-subject={pricing.subject ?? undefined}
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        {isShopifyApp && (
          <>
            <meta name="shopify-api-key" content={process.env.SHOPIFY_API_KEY ?? ''} />
            <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
          </>
        )}
        {!isEmailTokenPage && (
          <Script id="easyrender-google-tag" strategy="beforeInteractive">
            {GOOGLE_TAG_BOOTSTRAP}
          </Script>
        )}
      </head>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={pickClientMessages(messages)}>
          {children}
          {!isEmailTokenPage && <Analytics />}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
