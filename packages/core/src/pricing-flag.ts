import { createHash } from 'node:crypto';
import { PRICING_FLAG, type PricingVariant } from '@easyrender/harness/pricing';

// The PostHog flag, read and evaluated with no database and no framework, so proxy.ts can pick the
// pricing arm of an anonymous visitor at the edge. Identity seeds and subjects (they need the
// database) stay in pricing-experiment.ts.

// Deliberately supports only a single, property-free rollout. Unsupported targeting fails closed.
export type PricingFlag = {
  key: string;
  active: boolean;
  deleted?: boolean;
  filters: {
    aggregation_group_type_index?: number | null;
    groups: { properties: unknown[]; rollout_percentage: number; variant?: string | null }[];
    multivariate: { variants: { key: string; rollout_percentage: number }[] };
  };
};
const hash = (identity: string, salt = '') =>
  Number.parseInt(
    createHash('sha1').update(`${PRICING_FLAG}.${identity}${salt}`).digest('hex').slice(0, 15),
    16,
  ) / Number('0xfffffffffffffff');

/** Matches PostHog's property-free percentage and multivariate hash; never sends an identity. */
export function evaluatePricingFlag(
  flag: PricingFlag | null,
  identity: string | null,
): PricingVariant {
  if (!flag || !identity || flag.key !== PRICING_FLAG || !flag.active || flag.deleted)
    return 'control';
  const filters = flag.filters;
  if (!filters || filters.aggregation_group_type_index != null || filters.groups?.length !== 1)
    return 'control';
  const group = filters.groups[0];
  const variants = filters.multivariate?.variants;
  if (
    !group ||
    !Array.isArray(group.properties) ||
    group.properties.length ||
    group.variant ||
    !Number.isFinite(group.rollout_percentage) ||
    group.rollout_percentage <= 0 ||
    group.rollout_percentage > 100 ||
    !Array.isArray(variants) ||
    variants.length !== 2 ||
    new Set(variants.map((v) => v.key)).size !== 2 ||
    variants.some(
      (v) =>
        !['control', 'test'].includes(v.key) ||
        !Number.isFinite(v.rollout_percentage) ||
        v.rollout_percentage < 0 ||
        v.rollout_percentage > 100,
    ) ||
    variants.reduce((total, v) => total + v.rollout_percentage, 0) !== 100
  )
    return 'control';
  if (hash(identity) >= group.rollout_percentage / 100) return 'control';
  const bucket = hash(identity, 'variant');
  let end = 0;
  for (const variant of variants) {
    end += variant.rollout_percentage / 100;
    if (bucket < end) return variant.key === 'test' ? 'test' : 'control';
  }
  return 'control';
}

let cached: { until: number; flag: PricingFlag | null } | undefined;
let pending: Promise<PricingFlag | null> | undefined;
export function isPricingExperimentConfigured() {
  return (
    process.env.PRICING_AB_ENABLED === '1' &&
    Boolean(
      process.env.NEXT_PUBLIC_POSTHOG_KEY &&
        process.env.POSTHOG_PERSONAL_API_KEY &&
        process.env.POSTHOG_PROJECT_ID,
    )
  );
}
export async function pricingFlag(): Promise<PricingFlag | null> {
  if (!isPricingExperimentConfigured()) return null;
  if (cached && cached.until > Date.now()) return cached.flag;
  if (pending) return pending;
  pending = (async () => {
    let flag: PricingFlag | null = null;
    try {
      const host = process.env.POSTHOG_API_HOST || 'https://eu.posthog.com';
      const url = new URL(
        `/api/projects/${encodeURIComponent(process.env.POSTHOG_PROJECT_ID ?? '')}/feature_flags/`,
        host,
      );
      url.searchParams.set('key', PRICING_FLAG);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) {
        const body = (await response.json()) as { results?: PricingFlag[] };
        flag = body.results?.find((item) => item.key === PRICING_FLAG) ?? null;
      }
    } catch {
      /* Missing, malformed or unavailable flags always mean control. Never reuse stale flags. */
    }
    cached = { until: Date.now() + 30_000, flag };
    return flag;
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}
