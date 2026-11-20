'use client';

import { useSitePathname } from '@/lib/use-site-pathname';

/**
 * Shopify App Bridge, on /shopify only: the page runs inside the Shopify admin, which needs the
 * script loaded first in the head. The root layout used to read the request path to decide; it is
 * now built once for every page, so the decision is made here, from the address.
 */
export function ShopifyBridge({ apiKey }: { apiKey: string }) {
  if (useSitePathname() !== '/shopify') return null;
  return (
    <>
      <meta name="shopify-api-key" content={apiKey} />
      <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
    </>
  );
}
