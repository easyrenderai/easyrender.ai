import {
  type ChargeCurrency,
  currencyForCountry,
  type PricingVariant,
} from '@easyrender/harness/pricing';
import { evaluatePricingFlag, isPricingExperimentConfigured, pricingFlag } from './pricing-flag';

// What a marketing page shows for money: a currency and a pricing arm. It is the whole cache key of
// a priced page. proxy.ts decides it at the edge and rewrites the request to the page built for it,
// so a page is rendered once per key instead of once per visitor. No database in this file: the
// proxy imports it.

export type PricingContext = { currency: ChargeCurrency; variant: PricingVariant };

export const PRICING_CONTEXT_KEYS = ['usd.control', 'usd.test', 'eur.control', 'eur.test'] as const;
export type PricingContextKey = (typeof PRICING_CONTEXT_KEYS)[number];
export const DEFAULT_PRICING_CONTEXT_KEY: PricingContextKey = 'usd.control';

/** Remembers the authoritative context of a signed-in buyer, which the edge cannot read from a database. */
export const PRICING_CONTEXT_COOKIE = 'er_pc';

export const isPricingContextKey = (value: unknown): value is PricingContextKey =>
  typeof value === 'string' && (PRICING_CONTEXT_KEYS as readonly string[]).includes(value);

export const pricingContextKey = ({ currency, variant }: PricingContext): PricingContextKey =>
  `${currency}.${variant}`;

export function parsePricingContextKey(key: string): PricingContext | null {
  if (!isPricingContextKey(key)) return null;
  const [currency, variant] = key.split('.') as [ChargeCurrency, PricingVariant];
  return { currency, variant };
}

/** EUR for euro-area countries, USD otherwise. EUR_CHECKOUT_DISABLED=1 puts everyone back on USD. */
export const currencyForVisitor = (country: string | null | undefined): ChargeCurrency =>
  process.env.EUR_CHECKOUT_DISABLED === '1' ? 'usd' : currencyForCountry(country);

/**
 * The context of a visitor the edge can classify without a database: currency from the country
 * header, arm from the PostHog flag and the anonymous id. A signed-in buyer's last paid currency and
 * stored seed are applied by the viewer API, which writes them to the PRICING_CONTEXT_COOKIE.
 */
export async function visitorPricingContext(input: {
  country: string | null | undefined;
  anonId: string | null | undefined;
  remembered?: string | null;
}): Promise<PricingContextKey> {
  if (isPricingContextKey(input.remembered)) return input.remembered;
  const currency = currencyForVisitor(input.country);
  if (!isPricingExperimentConfigured() || !input.anonId)
    return pricingContextKey({ currency, variant: 'control' });
  const flag = await pricingFlag();
  const variant = flag?.active ? evaluatePricingFlag(flag, input.anonId) : 'control';
  return pricingContextKey({ currency, variant });
}

/**
 * True while the experiment is live (configured, and its flag active). Only then does an arm depend
 * on who the visitor is, so only then does the edge need to give a first-time visitor an anonymous
 * id. Without it every visitor is on control and a priced page carries no cookie, which keeps it
 * cacheable.
 */
export async function isPricingExperimentLive(): Promise<boolean> {
  if (!isPricingExperimentConfigured()) return false;
  return Boolean((await pricingFlag())?.active);
}
