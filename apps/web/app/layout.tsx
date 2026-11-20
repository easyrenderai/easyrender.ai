import type { Metadata } from 'next';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/components/query-provider';
import { RootHtml } from '@/components/root-html';
import { ShopifyBridge } from '@/components/shopify-bridge';
import { geistMono, geistSans } from '@/lib/fonts';
import { GOOGLE_TAG_BOOTSTRAP } from '@/lib/google-tag';
import { SITE_URL } from '@/lib/seo/site';
import './globals.css';

// metadataBase makes every relative canonical, Open Graph and sitemap URL absolute against the
// canonical origin, so a preview deployment never emits its own host in an indexable tag.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: 'en', namespace: 'Metadata' });
  return {
    metadataBase: new URL(SITE_URL),
    title: t('title'),
    description: t('description'),
  };
}

// The root of every route, and it reads nothing from the request: no headers, no cookies, no
// session. Reading any of them here would make every page of the site dynamic, which is what kept
// the marketing pages out of the edge cache. What used to be here lives where it can be decided
// without the request: the language of <html> comes from the route (components/root-html), the
// translations from each group's IntlBoundary, the pricing arm from the page's pricing key, the
// session from /api/viewer, and the private-page checks run in the browser.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <RootHtml className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <ShopifyBridge apiKey={process.env.SHOPIFY_API_KEY ?? ''} />
        <Script id="easyrender-google-tag" strategy="beforeInteractive">
          {GOOGLE_TAG_BOOTSTRAP}
        </Script>
      </head>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </RootHtml>
  );
}
