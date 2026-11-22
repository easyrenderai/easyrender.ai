import { describe, expect, it } from 'vitest';
import { eventProperties, eventUuid } from './analytics';
import {
  analyticsUrl,
  CONSENT_CONFIG,
  classifyCountry,
  hasFirstTouch,
  isToolAllowed,
  normalizeAttribution,
  STRICT_COUNTRIES,
  sanitizeProperties,
  toolPolicy,
} from './attribution';

describe('country and consent policy', () => {
  it.each(STRICT_COUNTRIES)('%s is strict', (country) => {
    expect(classifyCountry(country)).toEqual({ country, consent_region: 'strict' });
  });
  it.each([
    null,
    undefined,
    '',
    'XX',
    'T1',
    'A1',
    'A2',
    'O1',
    'EU',
    'AP',
    'ZZ',
    'zz1',
    'us',
    ' US',
  ])('unreliable %s is strict with no stored country', (value) => {
    expect(classifyCountry(value)).toEqual({ country: null, consent_region: 'strict' });
  });
  it('US is standard', () => {
    expect(classifyCountry('US').consent_region).toBe('standard');
  });
  it('gates optional tools, respects rejection and GPC, and defaults new tools conservatively', () => {
    for (const tool of ['ga4', 'ads']) {
      expect(CONSENT_CONFIG[tool]).toEqual({ strict: 'consent', standard: 'allow_unless_optout' });
      expect(isToolAllowed(tool, 'strict', null, false)).toBe(false);
      expect(isToolAllowed(tool, 'strict', true, false)).toBe(true);
      expect(isToolAllowed(tool, 'strict', true, true)).toBe(false);
      expect(isToolAllowed(tool, 'standard', null, false)).toBe(true);
      expect(isToolAllowed(tool, 'standard', null, true)).toBe(false);
      expect(isToolAllowed(tool, 'standard', false, false)).toBe(false);
    }
    // PostHog is cookieless and starts on load everywhere: no region, choice or GPC turns it off.
    expect(CONSENT_CONFIG.posthog).toEqual({ strict: 'always', standard: 'always' });
    expect(isToolAllowed('posthog', 'strict', null, false)).toBe(true);
    expect(isToolAllowed('posthog', 'strict', false, true)).toBe(true);
    expect(toolPolicy('new', 'strict')).toBe('consent');
    expect(toolPolicy('new', 'standard')).toBe('off');
    expect(isToolAllowed('serverEvents', 'strict', false, true)).toBe(true);
    expect(isToolAllowed('pixels', 'standard', true, false)).toBe(false);
  });
});
describe('first-touch normalization and event privacy', () => {
  const origin = 'https://easyrender.ai';
  it('normalizes, truncates and ignores click IDs and arbitrary fields without rejecting', () => {
    const result = normalizeAttribution(
      {
        utm_source: 'TeST',
        utm_campaign: 'Ä'.repeat(300),
        utm_medium: '',
        gclid: 'abc',
        fbclid: 'def',
        name: 'private',
        referrer: 'https://Other.test/Path?token=private#x',
        landing_path: '/HELLO?gclid=abc',
      },
      origin,
    );
    expect(result.utm_source).toBe('test');
    expect(result.utm_campaign).toBe('ä'.repeat(100));
    expect(result.utm_medium).toBeNull();
    expect(result.referrer).toBe('https://other.test/path');
    expect(result.landing_path).toBe('/hello');
    expect(JSON.stringify(result)).not.toMatch(/abc|def|private|gclid|fbclid/);
  });
  it('self referrers and malformed values become empty; initialized direct touches count', () => {
    expect(normalizeAttribution({ referrer: `${origin}/?x=1` }, origin).referrer).toBeNull();
    expect(
      normalizeAttribution({ referrer: 'garbage', utm_source: [] }, origin).utm_source,
    ).toBeNull();
    expect(hasFirstTouch(normalizeAttribution(null, origin))).toBe(true);
    expect(hasFirstTouch({})).toBe(false);
  });
  it('strips non-UTM parameters from URLs and nested properties', () => {
    const url = `${origin}/?utm_source=test&foo=1&gclid=abc&fbclid=def&token=private#fragment`;
    expect(analyticsUrl(url)).toBe(`${origin}/?utm_source=test`);
    expect(
      sanitizeProperties({
        $current_url: url,
        $referrer: url,
        $set: { $initial_current_url: url },
        gclid: 'abc',
        email: 'secret',
      }),
    ).toEqual({
      $current_url: `${origin}/?utm_source=test`,
      $referrer: `${origin}/?utm_source=test`,
      $set: { $initial_current_url: `${origin}/?utm_source=test` },
    });
  });
  it('builds exact common properties without leaking extra row fields', () => {
    const attribution = {
      ...normalizeAttribution(null, origin),
      email: 'secret',
      name: 'private',
      ipHash: 'hidden',
    };
    const props = eventProperties('event', {
      userId: 'u1',
      previewId: 'p1',
      source: 'web',
      attribution,
    });
    expect(Object.keys(props).sort()).toEqual(
      [
        'event_id',
        'user_id',
        'preview_id',
        'source_channel',
        'ft_utm_source',
        'ft_utm_medium',
        'ft_utm_campaign',
        'ft_utm_content',
        'ft_utm_term',
        'ft_referrer',
        'ft_landing_path',
        'geo_country',
        'consent_region',
      ].sort(),
    );
    expect(JSON.stringify(props)).not.toMatch(/secret|private|hidden|\$ip/);
  });
  it('replayed purchases have the same valid UUID; different orders differ', () => {
    expect(eventUuid('purchase:order-1')).toBe(eventUuid('purchase:order-1'));
    expect(eventUuid('purchase:order-1')).not.toBe(eventUuid('purchase:order-2'));
    expect(eventUuid('purchase:order-1')).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/,
    );
  });
});

describe('checkout metadata', () => {
  it('allowlists and bounds every Stripe value, strips private URL data, and rejects malformed identifiers', async () => {
    const { checkoutAttributionMetadata, normalizeCheckoutAttribution } = await import(
      './attribution'
    );
    const result = checkoutAttributionMetadata(
      normalizeCheckoutAttribution(
        {
          landing_path: '/es/pricing?email=private#secret',
          referrer_host: 'WWW.GOOGLE.COM',
          utm_source: 'google',
          utm_campaign: '😀'.repeat(800),
          utm_term: 'user@example.com',
          posthog_distinct_id: '$posthog_cookieless',
          posthog_session_id: 'not-a-session',
          gclid: 'bad?id',
          gbraid: 'a'.repeat(501),
          pricing_variant: 'forged',
          userId: 'forged',
          arbitrary: 'secret',
        },
        true,
        true,
      ),
    );
    expect(result).toEqual({
      at_landing_path: '/es/pricing',
      at_referrer_host: 'www.google.com',
      at_utm_source: 'google',
      at_utm_campaign: '😀'.repeat(250),
    });
    expect(Object.keys(result).length).toBeLessThan(40);
    expect(Object.values(result).every((value) => value.length <= 500)).toBe(true);
  });
  it.each(['/invite/private', '//evil.test/path', '/reset-password/private', '/\\evil.test'])(
    'drops unsafe path %s',
    async (landing_path) => {
      const { normalizeCheckoutAttribution } = await import('./attribution');
      expect(normalizeCheckoutAttribution({ landing_path }, true, true)).toEqual({});
    },
  );
});
