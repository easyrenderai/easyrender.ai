export const DAY = 86_400_000;
export const SLOTS = [0, 2, 5, 10, 20, 28] as const;
export const MAILING_VERSION = 'education-v4';
export const MAILING_ROUTES = [
  'ecommerce',
  'furniture',
  'agency',
  'api',
  'mcp',
  'product_views',
  'method_fit',
  'formats',
  'general',
] as const;
export type MailingRoute = (typeof MAILING_ROUTES)[number];
export type MailingLocale = 'es' | 'en';
export type MailingCopy = { subject: string; preheader: string; body: string; action: string };
export type MailingCatalog = Record<MailingLocale, Record<string, MailingCopy>>;
export function currentSlot(confirmedAt: Date, now: Date): number | null {
  const age = (+now - +confirmedAt) / DAY;
  if (!Number.isFinite(age) || age < 0 || age >= 30) return null;
  return SLOTS.find((day) => age >= day && age < day + 1) ?? null;
}
export function hasCapacity(sent: Date[], now: Date): boolean {
  return [
    [1, 1],
    [7, 3],
    [30, 6],
  ].every(([days, cap]) => sent.filter((date) => +date > +now - days * DAY).length < cap);
}
export function isSendingHour(timezone: string, now: Date): boolean {
  try {
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(now),
    );
    return hour >= 9 && hour < 19;
  } catch {
    return false;
  }
}
export function isLessonEligible(
  id: string,
  activity: { hasTask: boolean; hasResult: boolean; hasPurchase: boolean },
): boolean {
  if (['api_d10', 'mcp_d05', 'formats_d02'].includes(id)) return activity.hasResult;
  if (/_d(?:00|02)$/.test(id) && (activity.hasResult || activity.hasPurchase)) return false;
  if (id === 'mcp_d10') return activity.hasTask;
  return true;
}
