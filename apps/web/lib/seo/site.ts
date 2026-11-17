// The one canonical origin. Every canonical, hreflang and sitemap URL is built from it, so a
// preview deployment never leaks its own host into an indexable tag.
export const SITE_URL = 'https://easyrender.ai';
export const SITE_HOST = 'easyrender.ai';
export const SITE_NAME = 'Easy Render';

// Non-canonical hosts that must 301 somewhere other than the same path. Every other host is
// redirected to the same path on SITE_HOST (see proxy.ts).
export const LEGACY_HOSTS: Record<string, string> = {
  // The old Spanish marketing landing is replaced by the /es home.
  'easyrender-landing.vercel.app': '/es',
};

/** Absolute, canonical URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  if (path === '/') return SITE_URL;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

// The social card: one input photo beside the free angle sheet easyrender drew from it, both real
// output from public/showcase. 1200x630, the size Open Graph and summary_large_image expect.
export const OG_IMAGE = '/og.jpg';
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
