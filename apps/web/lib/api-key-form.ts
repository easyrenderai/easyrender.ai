import type { ApiKeyScope } from '@easyrender/core';

// Type-only core import: this module is also used by the browser form.
export const KEY_SCOPES = [
  'read',
  'write',
  'spend',
  'share',
] as const satisfies readonly ApiKeyScope[];
export const MAX_KEY_CREDIT_LIMIT = 2_147_483_647;

type KeyFormInput = { scopes: ApiKeyScope[]; creditLimit: string; expiresAt: string };
type KeyRestrictions = {
  scopes: ApiKeyScope[];
  creditLimit: number | null;
  expiresAt: string | null;
};
type KeyFormResult =
  | { value: KeyRestrictions; error?: never }
  | { error: keyof KeyFormInput; value?: never };

export function parseKeyRestrictions(input: KeyFormInput, now = Date.now()): KeyFormResult {
  if (input.scopes.length === 0 || !input.scopes.every((scope) => KEY_SCOPES.includes(scope)))
    return { error: 'scopes' };
  const creditLimit = input.creditLimit.trim() === '' ? null : Number(input.creditLimit);
  if (
    creditLimit !== null &&
    (!Number.isSafeInteger(creditLimit) || creditLimit < 0 || creditLimit > MAX_KEY_CREDIT_LIMIT)
  )
    return { error: 'creditLimit' };
  let expiresAt: string | null = null;
  if (input.expiresAt) {
    const expiry = new Date(input.expiresAt);
    const parts = input.expiresAt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (
      !parts ||
      !Number.isFinite(expiry.getTime()) ||
      expiry.getTime() <= now ||
      expiry.getFullYear() !== Number(parts[1]) ||
      expiry.getMonth() + 1 !== Number(parts[2]) ||
      expiry.getDate() !== Number(parts[3]) ||
      expiry.getHours() !== Number(parts[4]) ||
      expiry.getMinutes() !== Number(parts[5])
    )
      return { error: 'expiresAt' };
    expiresAt = expiry.toISOString();
  }
  return { value: { scopes: [...new Set(input.scopes)], creditLimit, expiresAt } };
}
