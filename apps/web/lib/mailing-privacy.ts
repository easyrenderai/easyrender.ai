const INVITE_PATH = /^\/invite\/[^/]+\/?$/;
const TOKEN_PATHS = [
  /^\/(?:api\/)?email\/(?:confirm|unsubscribe)(?:\/|$)/,
  /^\/api\/email\/verify-account(?:\/|$)/,
  /^\/(?:api\/auth\/)?(?:verify-email|reset-password)(?:\/|$)/,
];

/** Token links are private actions, not analytics landing pages. */
export function isMailingTokenLocation(value: string): boolean {
  try {
    const { pathname: path, searchParams } = new URL(
      value.replace(/^(?:GET|POST|HEAD|OPTIONS)\s+/i, ''),
      'https://easyrender.invalid',
    );
    return (
      INVITE_PATH.test(path) ||
      INVITE_PATH.test(searchParams.get('next') ?? '') ||
      TOKEN_PATHS.some((pattern) => pattern.test(path))
    );
  } catch {
    return false;
  }
}

/**
 * The same test as a script the browser runs before anything loads: the root layout is built once
 * for every page, so it can no longer read the request to leave the Google tag out of a token page.
 * mailing-privacy.test.ts runs both against the same addresses.
 */
export const MAILING_TOKEN_CHECK_SCRIPT = `function erIsMailingTokenLocation(href){try{var u=new URL(href);var p=u.pathname;var n=u.searchParams.get('next')||'';return ${INVITE_PATH}.test(p)||${INVITE_PATH}.test(n)||${TOKEN_PATHS.map((pattern) => `${pattern}.test(p)`).join('||')}}catch(e){return false}}`;

/** Remove tokens from URLs, bodies and nested breadcrumbs without mutating an SDK event. */
export function redactMailingTokens<T>(value: T): T {
  const seen = new WeakSet<object>();
  function visit(item: unknown): unknown {
    if (typeof item === 'string')
      return (
        item
          .replace(/(^|[?&])token=[^&#\s]*/gi, '$1token=[Filtered]')
          .replace(/((?:\/|%2f)invite(?:\/|%2f))[0-9a-f-]{36}\b/gi, '$1[Filtered]')
          // better-auth's emailed reset link carries the token as a path segment.
          .replace(/((?:\/|%2f)reset-password(?:\/|%2f))[^/?#&%\s]+/gi, '$1[Filtered]')
          .replace(/("token"\s*:\s*")[^"]*(")/gi, '$1[Filtered]$2')
      );
    if (!item || typeof item !== 'object') return item;
    if (seen.has(item)) return '[Circular]';
    seen.add(item);
    if (Array.isArray(item)) {
      if (item.length === 2 && typeof item[0] === 'string' && item[0].toLowerCase() === 'token')
        return [item[0], '[Filtered]'];
      return item.map(visit);
    }
    return Object.fromEntries(
      Object.entries(item).map(([key, nested]) => [
        key,
        key.toLowerCase() === 'token' ? '[Filtered]' : visit(nested),
      ]),
    );
  }
  return visit(value) as T;
}

// Span and trace attributes that carry the request location: OpenTelemetry's current and legacy
// names. Next names a route transaction by its template ("GET /api/auth/[...all]"), so the real
// path (and its token) is only in these.
const LOCATION_ATTRIBUTES = ['url.full', 'url.path', 'http.url', 'http.target', 'http.route'];

export type TelemetryEvent = {
  request?: { url?: string };
  transaction?: string;
  contexts?: { trace?: { data?: Record<string, unknown> } };
};

function telemetryLocations(event: TelemetryEvent): string[] {
  const data = event.contexts?.trace?.data ?? {};
  return [
    event.request?.url,
    event.transaction,
    ...LOCATION_ATTRIBUTES.map((key) => data[key]),
  ].filter((value): value is string => typeof value === 'string');
}

export function filterMailingTelemetry<T extends TelemetryEvent>(event: T): T | null {
  if (telemetryLocations(event).some(isMailingTokenLocation)) return null;
  return redactMailingTokens(event);
}
