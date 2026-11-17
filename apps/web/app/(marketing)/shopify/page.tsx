import type { Metadata } from 'next';
import { ShopifyApp } from '@/components/shopify-app';
import { noindexMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = noindexMetadata('Easy Render 3D & AR');

// The app's page inside the Shopify admin (the app URL in shopify.app.toml). The root layout adds
// the App Bridge script and the API key meta tag for this path; the marketing header and footer
// are hidden because the Shopify admin already frames the page.
export default function ShopifyAppPage() {
  return (
    <div className="er-embedded">
      <style>
        {'body:has(.er-embedded) > header, body:has(.er-embedded) > footer { display: none }'}
      </style>
      <ShopifyApp />
    </div>
  );
}
