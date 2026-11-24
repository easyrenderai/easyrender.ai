import { RENDER_CREDITS } from '@easyrender/harness/pricing';

export const MAX_GIFT_MODELS = 15;
export const MAX_GIFT_CREDITS = MAX_GIFT_MODELS * RENDER_CREDITS;
export const MAX_CREDIT_INVITE_BATCH = 1_000;

export function isCreditInviteId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function normalizedGiftEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
