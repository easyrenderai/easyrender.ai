/** Shared, browser-safe first-touch shapes. No identifiers or browser storage. */
export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;
export const ATTRIBUTION_KEYS = [
  ...UTM_KEYS,
  'referrer',
  'landing_path',
  'first_seen_at',
  'geo_country',
  'consent_region_at_create',
] as const;
export type Attribution = Record<(typeof ATTRIBUTION_KEYS)[number], string | null>;
export type ConsentRegion = 'strict' | 'standard';
export const CONFIG_VERSION = 'v1';
export const STRICT_COUNTRIES =
  'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE GF GP MQ RE YT MF AX IS LI NO GB GG JE IM GI CH'.split(
    ' ',
  );
const UNRELIABLE = new Set('XX T1 A1 A2 O1 EU AP ZZ'.split(' '));
export function classifyCountry(value: string | null | undefined) {
  const country = value && /^[A-Z]{2}$/.test(value) && !UNRELIABLE.has(value) ? value : null;
  return {
    country,
    consent_region: (!country || STRICT_COUNTRIES.includes(country)
      ? 'strict'
      : 'standard') as ConsentRegion,
  };
}
export type PrivacyRegion = ReturnType<typeof classifyCountry> & {
  gpc: boolean;
  config_version: string;
};
export type ToolPolicy = 'always' | 'consent' | 'allow_unless_optout' | 'off';
export const CONSENT_CONFIG: Record<string, Record<ConsentRegion, ToolPolicy>> = {
  attribution: { strict: 'always', standard: 'always' },
  serverEvents: { strict: 'always', standard: 'always' },
  // Vincent's decision (2026-11-12): PostHog starts on load in every region, with no consent gate.
  // It stays cookieless, memory-only and without person profiles; the banner only governs GA4.
  posthog: { strict: 'always', standard: 'always' },
  ga4: { strict: 'consent', standard: 'allow_unless_optout' },
  pixels: { strict: 'off', standard: 'off' },
};
export function toolPolicy(tool: string, region: ConsentRegion): ToolPolicy {
  return CONSENT_CONFIG[tool]?.[region] ?? (region === 'strict' ? 'consent' : 'off');
}
export function isToolAllowed(
  tool: string,
  region: ConsentRegion,
  choice: boolean | null,
  hasGpc: boolean,
) {
  const policy = toolPolicy(tool, region);
  if (policy === 'always') return true;
  if (hasGpc || choice === false || policy === 'off') return false;
  return policy === 'allow_unless_optout' || choice === true;
}
const text = (value: unknown) =>
  typeof value === 'string' ? value.toLowerCase().slice(0, 100) || null : null;
export function normalizeAttribution(
  value: unknown,
  origin: string,
  geo = classifyCountry(null),
  now = new Date(),
): Attribution {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const result = Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, null])) as Attribution;
  for (const key of UTM_KEYS) result[key] = text(input[key]);
  try {
    const url = new URL(String(input.referrer));
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== new URL(origin).origin)
      result.referrer = text(url.origin + url.pathname);
  } catch {
    /* Missing or malformed referrers are empty. */
  }
  try {
    const path = new URL(typeof input.landing_path === 'string' ? input.landing_path : '/', origin);
    result.landing_path = text(path.pathname);
  } catch {
    result.landing_path = '/';
  }
  result.first_seen_at = now.toISOString();
  result.geo_country = geo.country;
  result.consent_region_at_create = geo.consent_region;
  return result;
}
export function hasFirstTouch(value: Partial<Attribution>): boolean {
  return ATTRIBUTION_KEYS.some((key) => value[key] !== null && value[key] !== undefined);
}
export function pickAttribution(value: Attribution): Attribution {
  return Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, value[key]])) as Attribution;
}
/** Strip fragments, credentials and ALL non-UTM parameters, including click IDs. */
export function analyticsUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.username = '';
    url.password = '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()])
      if (!(UTM_KEYS as readonly string[]).includes(key)) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return '';
  }
}
export function sanitizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (
      /gclid|dclid|gbraid|wbraid|fbclid|msclkid|ttclid|email|token|password|\$ip|^\$?title$/i.test(
        key,
      )
    )
      continue;
    if (
      typeof value === 'string' &&
      key !== 'referrer_host' &&
      (/url|referrer|location/i.test(key) || /^https?:/.test(value))
    )
      result[key] = analyticsUrl(value);
    else if (value && typeof value === 'object' && !Array.isArray(value))
      result[key] = sanitizeProperties(value as Record<string, unknown>);
    else result[key] = value;
  }
  return result;
}
