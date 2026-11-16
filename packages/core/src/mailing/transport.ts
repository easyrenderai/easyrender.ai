import type { MailingCopy } from './policy';
import { escapeMailHtml } from './security';
export type MailingSystemCopy = {
  confirmSubject: string;
  confirmBody: string;
  confirmAction: string;
  footerReason: string;
  unsubscribeLabel: string;
  preferencesLabel: string;
};
export type MailingConfig = {
  secret: string;
  appUrl: string;
  apiKey: string;
  from: string;
  replyTo: string;
  identity: string;
};
export type MailPayload = {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
};
/** Fail closed in previews, local development, or incomplete sender setup. */
export function mailingConfig(): MailingConfig | null {
  const env = process.env;
  if (env.EMAIL_ONBOARDING_ENABLED !== 'true' || env.VERCEL_ENV !== 'production') return null;
  const secret = env.EMAIL_TOKEN_SECRET ?? '';
  const apiKey = env.RESEND_API_KEY ?? '';
  const from = env.EMAIL_FROM ?? '';
  const replyTo = env.EMAIL_REPLY_TO ?? '';
  const identity = env.EMAIL_LEGAL_IDENTITY ?? '';
  if (
    secret.length < 32 ||
    !apiKey ||
    !env.RESEND_WEBHOOK_SECRET ||
    !from.includes('@') ||
    !replyTo.includes('@') ||
    !identity.trim() ||
    /[\r\n]/.test(from + replyTo)
  )
    return null;
  try {
    const url = new URL(env.APP_URL ?? '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      return null;
    return { secret, apiKey, from, replyTo, identity, appUrl: url.origin };
  } catch {
    return null;
  }
}
export function recipientAllowed(email: string): boolean {
  if (!mailingConfig()) return false;
  const list = (process.env.EMAIL_ALLOWED_RECIPIENTS ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return list.length === 0 || list.includes(email.toLowerCase());
}
export function buildMailPayload(
  copy: MailingCopy,
  recipient: string,
  links: { unsubscribe: string; preferences: string; confirm?: string },
  text: MailingSystemCopy,
): MailPayload {
  const config = mailingConfig();
  if (!config) throw new Error('Email delivery is not configured');
  if (/[\r\n]/.test(copy.subject + recipient)) throw new Error('Invalid email header');
  for (const link of Object.values(links)) {
    const url = new URL(link);
    if (url.origin !== config.appUrl) throw new Error('Invalid email destination');
  }
  const content = [copy.body, links.confirm ? `${text.confirmAction}: ${links.confirm}` : '']
    .filter(Boolean)
    .join('\n\n');
  const footer = [
    links.confirm ? '' : text.footerReason,
    config.identity,
    `${text.preferencesLabel}: ${links.preferences}`,
    `${text.unsubscribeLabel}: ${links.unsubscribe}`,
  ]
    .filter(Boolean)
    .join('\n');
  const paragraphs = copy.body
    .split(/\n\n+/)
    .map((p) => `<p>${escapeMailHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
  const oneClick = new URL(links.unsubscribe);
  oneClick.pathname = '/api/email/unsubscribe';
  return {
    from: config.from,
    to: [recipient],
    reply_to: config.replyTo,
    subject: copy.subject,
    text: `${content}\n\n${footer}`,
    html: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div style="display:none;max-height:0;overflow:hidden">${escapeMailHtml(copy.preheader)}</div><main style="max-width:600px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;font-size:16px;line-height:1.6;overflow-wrap:anywhere">${paragraphs}${links.confirm ? `<p><a href="${escapeMailHtml(links.confirm)}">${escapeMailHtml(text.confirmAction)}</a></p>` : ''}<p>${escapeMailHtml(config.identity)}</p><p>${links.confirm ? '' : escapeMailHtml(text.footerReason)}</p><p><a href="${escapeMailHtml(links.preferences)}">${escapeMailHtml(text.preferencesLabel)}</a> · <a href="${escapeMailHtml(links.unsubscribe)}">${escapeMailHtml(text.unsubscribeLabel)}</a></p></main></body></html>`,
    headers: {
      'List-Unsubscribe': `<${oneClick}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}
export async function sendMail(
  payload: MailPayload,
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<{ status: 'accepted' | 'retry' | 'failed'; providerId?: string }> {
  const config = mailingConfig();
  if (!config || payload.to.length !== 1 || !recipientAllowed(payload.to[0]))
    return { status: 'failed' };
  try {
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `mailing/${id}`,
      },
      body: JSON.stringify(payload),
    });
    if (response.status === 409) {
      const error: unknown = await response.json();
      return {
        status:
          error &&
          typeof error === 'object' &&
          'name' in error &&
          error.name === 'concurrent_idempotent_requests'
            ? 'retry'
            : 'failed',
      };
    }
    if (!response.ok)
      return { status: response.status === 429 || response.status >= 500 ? 'retry' : 'failed' };
    const result: unknown = await response.json();
    if (
      !result ||
      typeof result !== 'object' ||
      !('id' in result) ||
      typeof result.id !== 'string' ||
      !result.id
    )
      return { status: 'retry' };
    return { status: 'accepted', providerId: result.id };
  } catch {
    return { status: 'retry' };
  }
}
