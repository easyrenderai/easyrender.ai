export const PRIVATE_TOKEN_PAGE_HEADER = 'x-easyrender-private-token-page';

const isInvitePath = (path: string) => /^\/invite\/[^/]+\/?$/.test(path);

/** Token links are private actions, not analytics landing pages. */
export function isMailingTokenLocation(value: string): boolean {
  try {
    const { pathname: path, searchParams } = new URL(
      value.replace(/^(?:GET|POST|HEAD|OPTIONS)\s+/i, ''),
      'https://easyrender.invalid',
    );
    return (
      isInvitePath(path) ||
      isInvitePath(searchParams.get('next') ?? '') ||
      /^\/(?:api\/)?email\/(?:confirm|unsubscribe)(?:\/|$)/.test(path) ||
      /^\/api\/email\/verify-account(?:\/|$)/.test(path) ||
      /^\/(?:api\/auth\/)?(?:verify-email|reset-password)(?:\/|$)/.test(path)
    );
  } catch {
    return false;
  }
}

/** Remove tokens from URLs, bodies and nested breadcrumbs without mutating an SDK event. */
export function redactMailingTokens<T>(value: T): T {
  const seen = new WeakSet<object>();
  function visit(item: unknown): unknown {
    if (typeof item === 'string')
      return item
        .replace(/(^|[?&])token=[^&#\s]*/gi, '$1token=[Filtered]')
        .replace(/((?:\/|%2f)invite(?:\/|%2f))[0-9a-f-]{36}\b/gi, '$1[Filtered]')
        .replace(/("token"\s*:\s*")[^"]*(")/gi, '$1[Filtered]$2');
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

export function filterMailingTelemetry<
  T extends { request?: { url?: string }; transaction?: string },
>(event: T): T | null {
  if (
    isMailingTokenLocation(event.request?.url ?? '') ||
    isMailingTokenLocation(event.transaction ?? '')
  )
    return null;
  return redactMailingTokens(event);
}
