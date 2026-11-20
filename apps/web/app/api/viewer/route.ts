import { PRICING_CONTEXT_COOKIE, pricingContextKey } from '@easyrender/core/pricing-context';
import { type NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, isRoutableLocale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';
import { APP_LOCALE_COOKIE } from '@/lib/app-locale';
import { loadHeaderAccount } from '@/lib/header-account';
import { HOME_LOCALE_MAX_AGE } from '@/lib/home-locale-constants';
import { currentTopupPricing, viewerPricing } from '@/lib/pricing';
import type { ViewerResponse } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

/**
 * The visitor-specific half of a marketing page: session, balance, pricing arm, subscriber quote.
 * Marketing pages are built once per pricing key and cached at the edge, so none of this can be in
 * their HTML. Always private, and cheap for a visitor: with no session cookie nothing here reads the
 * database.
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('locale');
  const locale = isRoutableLocale(requested) ? requested : DEFAULT_LOCALE;
  const user = await currentUser().catch(() => null);
  const [pricing, account, topup] = await Promise.all([
    viewerPricing(),
    user ? loadHeaderAccount(user.id, locale) : null,
    user ? currentTopupPricing().catch(() => null) : null,
  ]);
  const key = pricingContextKey(pricing);
  const body: ViewerResponse = {
    signedIn: Boolean(user),
    account,
    pricing: { key, variant: pricing.variant, subject: pricing.subject },
    topup: topup?.plan ? topup : null,
  };
  const response = NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
  // The edge picks a marketing page's pricing key without a database. A signed-in buyer's key can
  // differ from the one their country and anonymous id give (their last paid currency, their stored
  // arm), so it is remembered here and read by proxy.ts. Signing out forgets it.
  if (user)
    response.cookies.set(PRICING_CONTEXT_COOKIE, key, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  else if (request.cookies.has(PRICING_CONTEXT_COOKIE))
    response.cookies.delete(PRICING_CONTEXT_COOKIE);
  // The language the app opens in is the one the visitor last read the site in. A cached marketing
  // page cannot carry that cookie, so it is written here, once the page is open.
  if (request.cookies.get(APP_LOCALE_COOKIE)?.value !== locale)
    response.cookies.set(APP_LOCALE_COOKIE, locale, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: HOME_LOCALE_MAX_AGE,
    });
  return response;
}
