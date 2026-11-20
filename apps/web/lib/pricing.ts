import 'server-only';
import {
  assignedPricing,
  buyerCurrency,
  getTopupPricing,
  isPricingExperimentConfigured,
  pricingSubject,
} from '@easyrender/core';
import {
  type PricingContextKey,
  parsePricingContextKey,
  pricingContextKey,
} from '@easyrender/core/pricing-context';
import { displayPricing } from '@easyrender/harness';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { resolveViewerActor } from '@/lib/actor';

// Two ways to know what money to show, and they never mix:
//
// - A marketing page is built once per pricing key (currency and arm, see
//   @easyrender/core/pricing-context). proxy.ts picks the key for the visitor and rewrites the
//   request to the page built for it; the page calls setPricingContext(key) and then
//   currentPricing() reads it. Nothing about the visitor is read while rendering, which is what
//   lets the edge cache the page.
// - A page for one signed-in person (Credits, the viewer API) asks viewerPricing(), which reads
//   the session, the last paid currency and the stored arm.

const pageKey = cache((): { key: PricingContextKey | null } => ({ key: null }));

/** Called first thing by every priced page and its generateMetadata, with the `key` route param. */
export function setPricingContext(key: string): PricingContextKey {
  const context = parsePricingContextKey(key);
  if (!context) notFound();
  const valid = pricingContextKey(context);
  pageKey().key = valid;
  return valid;
}

/** The figures of the page being rendered. Throws when the page forgot setPricingContext(). */
export const currentPricing = cache(async () => {
  const key = pageKey().key;
  const context = key && parsePricingContextKey(key);
  if (!context) throw new Error('currentPricing() needs setPricingContext() in the page');
  return displayPricing(context.variant, context.currency);
});

// One answer for the request; never shared across visitors. Amounts are in the currency the visitor
// will be charged: EUR for euro-area countries (Vercel sets the country at the edge), USD otherwise,
// and a returning buyer keeps their last currency.
export const viewerPricing = cache(async () => {
  const { userId, anonId, geoCountry } = await resolveViewerActor();
  const currency = await buyerCurrency(userId ?? null, geoCountry);
  if (!isPricingExperimentConfigured())
    return { ...displayPricing('control', currency), subject: null };
  const variant = await assignedPricing(userId ?? null, anonId);
  return {
    ...displayPricing(variant, currency),
    subject: await pricingSubject(userId ?? null, anonId),
  };
});

// Subscriber quotes are personal, request-scoped, and shared by Credits and the viewer API.
export const currentTopupPricing = cache(async () => {
  const [{ userId }, pricing] = await Promise.all([resolveViewerActor(), viewerPricing()]);
  return getTopupPricing(userId, pricing.variant, pricing.currency);
});
