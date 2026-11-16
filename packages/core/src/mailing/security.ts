import { createHmac, timingSafeEqual } from 'node:crypto';

type Purpose = 'confirm' | 'unsubscribe';
export function makeMailToken(id: string, nonce: string, purpose: Purpose, secret: string): string {
  if (secret.length < 32) throw new Error('Mail token secret is not configured');
  const body = Buffer.from(JSON.stringify({ id, nonce, purpose })).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
export function readMailToken(
  token: string,
  purpose: Purpose,
  secret: string,
): { id: string; nonce: string } | null {
  if (token.length > 2000 || secret.length < 32) return null;
  try {
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra !== undefined) return null;
    const expected = createHmac('sha256', secret).update(body).digest('base64url');
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, Buffer.from(expected)))
      return null;
    const value = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    if (
      value.purpose !== purpose ||
      typeof value.id !== 'string' ||
      typeof value.nonce !== 'string'
    )
      return null;
    return { id: value.id, nonce: value.nonce };
  } catch {
    return null;
  }
}
export function escapeMailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
