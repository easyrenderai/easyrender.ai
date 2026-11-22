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
  // It stays cookieless, memory-only and without person profiles; the banner governs Google.
  posthog: { strict: 'always', standard: 'always' },
  ga4: { strict: 'consent', standard: 'allow_unless_optout' },
  ads: { strict: 'consent', standard: 'allow_unless_optout' },
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
export function sanitizeProperties(
  properties: Record<string, unknown>,
  hasAdvertisingConsent = false,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (
      hasAdvertisingConsent &&
      /^(gclid|gbraid|wbraid)$/.test(key) &&
      typeof value === 'string' &&
      /^[A-Za-z0-9_-]{1,500}$/.test(value)
    ) {
      result[key] = value;
      continue;
    }
    if (
      /gclid|dclid|gbraid|wbraid|fbclid|msclkid|ttclid|email|token|password|\$ip|^\$?title$/i.test(
        key,
      )
    )
      continue;
    if (
      typeof value === 'string' &&
      key !== 'referrer_host' &&
      !(key === 'ft_referrer' && /^[a-z0-9.-]+$/i.test(value)) &&
      (/url|referrer|location/i.test(key) || /^https?:/.test(value))
    )
      result[key] = analyticsUrl(value);
    else if (value && typeof value === 'object' && !Array.isArray(value))
      result[key] = sanitizeProperties(value as Record<string, unknown>);
    else result[key] = value;
  }
  return result;
}

const CHECKOUT_KEYS = [
  ...UTM_KEYS,
  'landing_path',
  'referrer_host',
  'posthog_session_id',
  'posthog_distinct_id',
  'gclid',
  'gbraid',
  'wbraid',
] as const;
export type CheckoutAttribution = Partial<Record<(typeof CHECKOUT_KEYS)[number], string>>;

/** Bounded allowlist for untrusted checkout input and Stripe metadata read-back. */
export function normalizeCheckoutAttribution(
  value: unknown,
  isAnalyticsAllowed: boolean,
  isAdvertisingAllowed: boolean,
): CheckoutAttribution {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const result: CheckoutAttribution = {};
  for (const key of CHECKOUT_KEYS) {
    const raw = input[key];
    if (typeof raw !== 'string') continue;
    // Bound UTF-16 length without cutting a surrogate pair. Control characters are never metadata.
    const clean = Array.from(raw.replace(/[\p{Cc}\p{Cf}]/gu, '').trim())
      .slice(0, 250)
      .join('');
    if (!clean) continue;
    if (key === 'posthog_distinct_id' || key === 'posthog_session_id') {
      if (!isAnalyticsAllowed || !/^[A-Za-z0-9_-]{1,200}$/.test(raw)) continue;
      if (key === 'posthog_session_id' && !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(raw))
        continue;
      result[key] = raw;
    } else if (key === 'gclid' || key === 'gbraid' || key === 'wbraid') {
      if (isAnalyticsAllowed && isAdvertisingAllowed && /^[A-Za-z0-9_-]{1,500}$/.test(raw))
        result[key] = raw;
    } else if (key === 'landing_path') {
      if (!clean.startsWith('/') || clean.startsWith('//') || clean.includes('\\')) continue;
      try {
        const path = new URL(clean, 'https://attribution.invalid').pathname;
        // Token-bearing routes never become analytics context, even without a query string.
        if (/\/(?:invite|reset-password|verify-email|email)(?:\/|$)/i.test(path)) continue;
        result[key] = path.slice(0, 500).replace(/%[\da-f]?$/i, '');
      } catch {
        /* Ignore malformed paths. */
      }
    } else if (key === 'referrer_host') {
      if (/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(clean))
        result[key] = clean.toLowerCase();
    } else {
      // Campaign labels, never addresses, URLs or arbitrary query strings.
      if (/@|https?:|[?=#&]/i.test(clean)) continue;
      result[key] = clean;
    }
  }
  return result;
}

export function checkoutAttributionMetadata(value: CheckoutAttribution): Record<string, string> {
  return Object.fromEntries(
    Object.entries(normalizeCheckoutAttribution(value, true, true)).map(([key, value]) => [
      `at_${key}`,
      value,
    ]),
  );
}

export function checkoutAttributionFromMetadata(
  metadata: Record<string, string> | null | undefined,
) {
  return normalizeCheckoutAttribution(
    Object.fromEntries(CHECKOUT_KEYS.map((key) => [key, metadata?.[`at_${key}`]])),
    true,
    true,
  );
}
