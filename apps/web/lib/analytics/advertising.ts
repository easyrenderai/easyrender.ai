import { analyticsUrl } from '@easyrender/core/attribution';

/** Google-only click attribution, never part of general product analytics. */
export const AD_CLICK_KEYS = ['gclid', 'dclid', 'gbraid', 'wbraid'] as const;
export const AD_TOUCH_TTL = 30 * 60 * 1000;
export type AdvertisingTouch = {
  ids: Partial<Record<(typeof AD_CLICK_KEYS)[number], string>>;
  expiresAt: number;
};
function ids(value: unknown): AdvertisingTouch['ids'] {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    AD_CLICK_KEYS.flatMap((key) =>
      typeof input[key] === 'string' && /^[A-Za-z0-9_-]{1,512}$/.test(input[key])
        ? [[key, input[key]]]
        : [],
    ),
  );
}
export function readAdvertisingTouch(
  url: string,
  saved: unknown,
  isAllowed: boolean,
  now = Date.now(),
): AdvertisingTouch | null {
  if (!isAllowed) return null;
  try {
    const current = ids(Object.fromEntries(new URL(url).searchParams));
    const previous = saved && typeof saved === 'object' ? (saved as Record<string, unknown>) : {};
    const previousIds = ids(previous.ids);
    const isFresh =
      typeof previous.expiresAt === 'number' &&
      previous.expiresAt > now &&
      previous.expiresAt <= now + AD_TOUCH_TTL;
    if (
      isFresh &&
      Object.keys(previousIds).length &&
      (!Object.keys(current).length || JSON.stringify(current) === JSON.stringify(previousIds))
    )
      return { ids: previousIds, expiresAt: previous.expiresAt as number };
    if (Object.keys(current).length) return { ids: current, expiresAt: now + AD_TOUCH_TTL };
  } catch {
    /* Invalid URLs cannot grant attribution. */
  }
  return null;
}
export function advertisingUrl(value: string, touch: AdvertisingTouch | null, now = Date.now()) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const clean = new URL(analyticsUrl(value));
    if (touch && touch.expiresAt > now && touch.expiresAt <= now + AD_TOUCH_TTL)
      for (const [key, value] of Object.entries(ids(touch.ids))) clean.searchParams.set(key, value);
    return clean.toString();
  } catch {
    return '';
  }
}
