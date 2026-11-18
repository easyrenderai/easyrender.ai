// Pure helpers, importable from the edge proxy: no database, no Node-only modules.

// No 0, 1, I, L or O: a code read aloud or typed from a screenshot stays unambiguous.
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;
const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

export const REFERRAL_COOKIE = 'er_ref';
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** The canonical form of a code from a URL or cookie, or null when it cannot be one of ours. */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}
