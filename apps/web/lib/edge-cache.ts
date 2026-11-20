import { isAppLocalePath } from '@/lib/app-locale';

/**
 * True for a page whose HTML is the same for every visitor of its URL, which the edge may keep:
 * the marketing pages. False for the app, the API, sign in and files, which are per visitor or
 * per request. proxy.ts sets cookies and no-store only on the second kind: a cookie on a cacheable
 * response would stop the CDN from keeping it.
 */
export function isEdgeCachedPage(pathname: string): boolean {
  if (isAppLocalePath(pathname)) return false;
  if (/^\/(?:api|_next|monitoring)(?:\/|$)/.test(pathname)) return false;
  if (/^\/(?:[a-z]{2}\/)?sign-(?:in|up)(?:\/|$)/.test(pathname)) return false;
  return !pathname.includes('.');
}
