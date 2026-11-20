import {
  BUILD_FROM_VIEWS_CREDITS,
  BUILD_QUALITY_CREDITS,
  displayPricing,
  ENTERPRISE_BOOKING_URL,
  PRODUCT_VIEWS_CREDITS,
  PUBLIC_PLAN_IDS,
  pricingFor,
  RENDER_CREDITS,
  SHEET_CREDITS,
  UPSCALE_CREDITS,
  VIEW_POLISH_CREDITS,
} from '@easyrender/harness';
import { buyerCurrency, getTopupPricing } from './billing';
import { config } from './config';
import { getBalance } from './credits';
import { assignedPricing } from './pricing-experiment';
import type { Actor } from './renders';

// Same source as checkout: the buyer's existing currency wins over their current location,
// and subscribers get their contract's top-up rate rather than the current public offer.
export async function getCreditQuote(actor: Actor & { userId: string }) {
  const [variant, currency, balance] = await Promise.all([
    assignedPricing(actor.userId, actor.anonId),
    buyerCurrency(actor.userId, actor.geoCountry),
    getBalance(actor.userId),
  ]);
  const pricing = displayPricing(variant, currency);
  const topup = await getTopupPricing(actor.userId, variant, currency);
  return {
    pricing_variant: variant,
    currency,
    balance,
    render_credits: RENDER_CREDITS,
    render_credits_by_quality: { ...BUILD_QUALITY_CREDITS },
    sheet_credits: SHEET_CREDITS,
    product_views_credits: PRODUCT_VIEWS_CREDITS,
    view_polish_credits: VIEW_POLISH_CREDITS,
    upscale_credits: UPSCALE_CREDITS,
    build_from_views_credits: BUILD_FROM_VIEWS_CREDITS,
    plans: {
      pay_as_you_go: {
        price_per_credit: pricing.creditPrice,
        ...(currency === 'usd' ? { usd_per_credit: pricing.creditPrice } : {}),
        min_credits: pricing.payg.min,
        max_credits: pricing.payg.max,
      },
      ...Object.fromEntries(
        PUBLIC_PLAN_IDS.map((id) => [
          id,
          {
            price_per_month: pricing.plans[id].priceCents / 100,
            ...(currency === 'usd' ? { usd_per_month: pricing.plans[id].priceCents / 100 } : {}),
            credits_per_month: pricingFor(variant).plans[id].monthlyCredits,
          },
        ]),
      ),
      enterprise: { book_a_call: ENTERPRISE_BOOKING_URL },
    },
    topup: {
      plan: topup.plan,
      currency: topup.currency,
      price_cents: topup.priceCents,
      credits_per_unit: topup.creditsPerUnit,
    },
    buy: `${config.appUrl()}/credits`,
  };
}
