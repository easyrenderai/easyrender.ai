// Credits are sold at a 70% margin over what Replicate charges. 1 credit = $0.01.

export const MARGIN = 0.7;
export const CREDIT_USD = 0.01;

export function creditsFor(costUsd: number): number {
  return Math.ceil(Number((costUsd / (1 - MARGIN) / CREDIT_USD).toFixed(6)));
}

// The draft angle sheet (one 1K image). The free preview makes one at our cost; this is what
// generating one later, from the library, costs. It counts toward the 3D render's price.
export const SHEET_COST_USD = 0.034;
export const SHEET_CREDITS = creditsFor(SHEET_COST_USD);

// A paid build redraws the sheet at 2K with the final model, then builds from it. That 2K sheet
// plus a typical TRELLIS run (~60s on an A100, which is a ceiling: Replicate lists about $0.047
// and 34s for a typical run) is what one full render costs us.
export const FINAL_SHEET_COST_USD = 0.101;
export const BUILD_COST_USD = 0.09;
export const RENDER_COST_USD = FINAL_SHEET_COST_USD + BUILD_COST_USD;
export const RENDER_CREDITS = creditsFor(RENDER_COST_USD);

// The upscaler, per output image. It is the paid Upscale action (one finished picture, a product
// view or the angle sheet of a paid render, enlarged to print size, at a flat price because the
// upscaler charges per picture) and the upscale step inside product views.
export const ENLARGE_COST_USD = 0.006;
export const UPSCALE_CREDITS = creditsFor(ENLARGE_COST_USD);

// Product views: one photo in, nine packshots out on white, with no 3D build. The 2K sheet is drawn
// once, each view is upscaled to the packshot size, and the price keeps room for one view the
// checks send back for a redraw (a 1K single view plus its upscale). Nothing in it is 3D.
export const PRODUCT_VIEW_COUNT = 9;
export const VIEW_REDRAW_COST_USD = SHEET_COST_USD + ENLARGE_COST_USD;
export const PRODUCT_VIEWS_COST_USD =
  FINAL_SHEET_COST_USD + PRODUCT_VIEW_COUNT * ENLARGE_COST_USD + VIEW_REDRAW_COST_USD;
export const PRODUCT_VIEWS_CREDITS = creditsFor(PRODUCT_VIEWS_COST_USD);
// Polishing one view: the owner describes what is wrong and that view is drawn again.
export const VIEW_POLISH_CREDITS = creditsFor(VIEW_REDRAW_COST_USD);
// A 3D build from a finished set reuses its 2K sheet, so it only charges for what is left of a
// full render: the 3D step.
export const FINAL_SHEET_CREDITS = creditsFor(FINAL_SHEET_COST_USD);
export const BUILD_FROM_VIEWS_CREDITS = RENDER_CREDITS - FINAL_SHEET_CREDITS;

// Pay as you go: buy any number of credits at CREDIT_USD each, through one Stripe price of $0.01.
export const PAYG = { min: 500, max: 100_000, presets: [1000, 2500, 5000, 10_000] };

// Monthly plans: each adds its credits on every paid invoice. Credits never expire. A plan always
// has a cheaper credit than pay as you go ($0.01), and a bigger plan a cheaper one still. Per
// credit: Creator $0.0095 (5% off), Pro $0.0089 (11% off), Scale $0.0083 (17% off), which leaves a
// margin over provider cost of about 68%, 66% and 64%.
export const SUBSCRIPTION_PLANS = {
  creator: { label: 'Creator', priceCents: 1900, monthlyCredits: 2000 },
  pro: { label: 'Pro', priceCents: 4900, monthlyCredits: 5500 },
  scale: { label: 'Scale', priceCents: 14900, monthlyCredits: 18_000 },
} as const;

export type PlanId = keyof typeof SUBSCRIPTION_PLANS;
// Keep every billed plan for renewals, portal changes and historical reporting.
export const PLAN_IDS = Object.keys(SUBSCRIPTION_PLANS) as PlanId[];
// Only Pro is offered to new subscribers. Creator and Scale are grandfathered.
export const PUBLIC_PLAN_IDS: readonly PlanId[] = ['pro'];
export const isPlanId = (value: unknown): value is PlanId =>
  typeof value === 'string' && Object.hasOwn(SUBSCRIPTION_PLANS, value);

export const PRO_PLAN = SUBSCRIPTION_PLANS.pro;

// Enterprise has no Stripe product: it books a call.
export const ENTERPRISE_BOOKING_URL = 'https://calendar.app.google/nXsPoPWMDeNfKte29';

export const PRICING_FLAG = 'pricing-test-2026-11';
export type PricingVariant = 'control' | 'test';
export const pricingFor = (variant: PricingVariant = 'control') => ({
  variant,
  creditUsd: variant === 'test' ? 0.02 : CREDIT_USD,
  payg: PAYG,
  plans:
    variant === 'test'
      ? {
          creator: { label: 'Creator', priceCents: 2900, monthlyCredits: 1600 },
          pro: { label: 'Pro', priceCents: 7900, monthlyCredits: 4500 },
          scale: { label: 'Scale', priceCents: 19900, monthlyCredits: 12_000 },
        }
      : SUBSCRIPTION_PLANS,
});

// Fixed per-currency prices (Stripe `currency_options` on the same price IDs). USD stays the base
// currency. Buyers in euro-area countries are charged these EUR amounts; Adaptive Pricing stays off.
export type ChargeCurrency = 'usd' | 'eur';
export const EURO_AREA_COUNTRIES: ReadonlySet<string> = new Set([
  'AT',
  'BE',
  'BG',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
]);
export const currencyForCountry = (country: string | null | undefined): ChargeCurrency =>
  country && EURO_AREA_COUNTRIES.has(country.toUpperCase()) ? 'eur' : 'usd';

export const EUR_PRICING = {
  control: { creditCents: 1, plans: { creator: 1800, pro: 4600, scale: 13_900 } },
  test: { creditCents: 2, plans: { creator: 2700, pro: 7400, scale: 18_500 } },
} as const;

/** What a buyer in `currency` sees and pays: the per-credit price and each plan, in that currency. */
export function displayPricing(
  variant: PricingVariant = 'control',
  currency: ChargeCurrency = 'usd',
) {
  const base = pricingFor(variant);
  const plans = Object.fromEntries(
    PLAN_IDS.map((id) => [
      id,
      { ...base.plans[id], priceCents: unitAmountCents(id, variant, currency) },
    ]),
  ) as Record<PlanId, { label: string; priceCents: number; monthlyCredits: number }>;
  return {
    variant,
    currency,
    creditPrice: unitAmountCents('payg', variant, currency) / 100,
    payg: base.payg,
    plans,
  };
}

/** The unit amount (in cents) the Stripe price must carry for a plan or one pay-as-you-go credit. */
export const unitAmountCents = (
  plan: 'payg' | PlanId,
  variant: PricingVariant = 'control',
  currency: ChargeCurrency = 'usd',
) => {
  if (currency === 'eur')
    return plan === 'payg' ? EUR_PRICING[variant].creditCents : EUR_PRICING[variant].plans[plan];
  return plan === 'payg' ? paygPriceCents(1, variant) : pricingFor(variant).plans[plan].priceCents;
};

export const isValidPaygCredits = (credits: number, variant: PricingVariant = 'control') => {
  const { payg } = pricingFor(variant);
  return Number.isInteger(credits) && credits >= payg.min && credits <= payg.max;
};

export const paygPriceCents = (credits: number, variant: PricingVariant = 'control') =>
  Math.round(credits * pricingFor(variant).creditUsd * 100);

/** A rational rate: retain the plan's exact cents/credits until the whole pack is rounded. */
export function topupPricing(
  subscription: { status: string | null; plan: string | null; variant: PricingVariant } | null,
  paygVariant: PricingVariant = 'control',
  currency: ChargeCurrency = 'usd',
) {
  const plan =
    subscription &&
    (subscription.status === 'active' || subscription.status === 'trialing') &&
    isPlanId(subscription.plan)
      ? subscription.plan
      : null;
  const variant = plan && subscription ? subscription.variant : paygVariant;
  return {
    plan,
    variant,
    currency,
    priceCents: unitAmountCents(plan ?? 'payg', variant, currency),
    creditsPerUnit: plan ? pricingFor(variant).plans[plan].monthlyCredits : 1,
  };
}

/** Round once, half up to the nearest cent; never round the per-credit rate first. */
export function topupAmountCents(
  credits: number,
  rate: Pick<ReturnType<typeof topupPricing>, 'priceCents' | 'creditsPerUnit'>,
) {
  return Math.round((credits * rate.priceCents) / rate.creditsPerUnit);
}

export const rendersFor = (credits: number) => Math.floor(credits / RENDER_CREDITS);
