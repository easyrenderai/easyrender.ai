import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { gaMeasurementId } from './lib/analytics/config';
import { NOINDEX_HEADER_PATHS } from './lib/seo/noindex';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const STATIC_MEDIA_PATHS = ['/studio/:path*', '/showcase/:path*'];

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_GA_MEASUREMENT_ID: gaMeasurementId() },
  images: { qualities: [75, 85] },
  transpilePackages: [
    '@easyrender/core',
    '@easyrender/db',
    '@easyrender/harness',
    '@easyrender/mcp',
  ],
  serverExternalPackages: ['sharp', 'pg'],
  // Guides are content files read at request time, so they have to travel with the deployment.
  outputFileTracingIncludes: { '/**': ['./content/**/*'] },
  // noindex as a response header as well as a meta tag: the header covers a route before anyone
  // adds a generateMetadata to it, which matters most for the ad landings.
  async headers() {
    return [
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
      ...NOINDEX_HEADER_PATHS.map((source) => ({
        source,
        headers: [{ key: 'x-robots-tag', value: 'noindex, follow' }],
      })),
      // The Shopify app's page is shown inside the Shopify admin, so only Shopify may frame it.
      {
        source: '/shopify',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors https://*.myshopify.com https://admin.shopify.com',
          },
        ],
      },
      // The studio models, photos and showcase files in public/ are served with max-age=0 by
      // default, so every visit revalidated megabytes of GLB. Their names carry no content hash,
      // so they get a day of freshness and a week of stale-while-revalidate, not `immutable`.
      // A browser can keep painting the previous bytes through that window. When a GLB is
      // replaced, bump PUBLIC_MODEL_VERSION in lib/public-models.ts so the page requests a new URL.
      ...STATIC_MEDIA_PATHS.map((source) => ({
        source,
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      })),
    ];
  },
};

// Source maps upload only when SENTRY_AUTH_TOKEN is set (Vercel build); otherwise this is a no-op.
export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
});
