import type { MailingCopy } from './policy';
import { renderBrandedEmail } from './template';
export type MailingSystemCopy = {
  lang?: string;
  signature?: string;
  confirmTitle?: string;
  confirmPreheader?: string;
  educationalActionLabel?: string;
  confirmSubject: string;
  confirmBody: string;
  confirmAction: string;
  footerReason: string;
  unsubscribeLabel: string;
  preferencesLabel: string;
};
export type ResendConfig = {
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
export type MailingConfig = ResendConfig & { secret: string };
/** Fail closed in previews, local development, or incomplete sender setup. */
export function resendConfig(): ResendConfig | null {
  const env = process.env;
  if (env.VERCEL_ENV !== 'production') return null;
  const apiKey = env.RESEND_API_KEY ?? '';
  const from = env.EMAIL_FROM ?? '';
  const replyTo = env.EMAIL_REPLY_TO ?? '';
  const identity = env.EMAIL_LEGAL_IDENTITY ?? '';
  if (
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
    return { apiKey, from, replyTo, identity, appUrl: url.origin };
  } catch {
    return null;
  }
}
export function mailingConfig(): MailingConfig | null {
  const config = resendConfig();
  const secret = process.env.EMAIL_TOKEN_SECRET ?? '';
  return config && process.env.EMAIL_ONBOARDING_ENABLED === 'true' && secret.length >= 32
    ? { ...config, secret }
    : null;
}
export function recipientAllowed(email: string): boolean {
  return Boolean(mailingConfig()) && resendRecipientAllowed(email);
}
export function resendRecipientAllowed(email: string): boolean {
  if (!resendConfig() || /[\r\n]/.test(email)) return false;
  const list = (process.env.EMAIL_ALLOWED_RECIPIENTS ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return list.length === 0 || list.includes(email.toLowerCase());
}
export function buildMailPayload(
  copy: MailingCopy,
  recipient: string,
  links: {
    unsubscribe: string;
    preferences: string;
    confirm?: string;
    action?: { url: string; label: string };
  },
  text: MailingSystemCopy,
): MailPayload {
  const config = mailingConfig();
  if (!config) throw new Error('Email delivery is not configured');
  if (/[\r\n]/.test(copy.subject + recipient)) throw new Error('Invalid email header');
  for (const link of [
    links.unsubscribe,
    links.preferences,
    links.confirm,
    links.action?.url,
  ].filter((v): v is string => Boolean(v))) {
    const url = new URL(link);
    if (url.origin !== config.appUrl) throw new Error('Invalid email destination');
  }
  const content = [
    copy.body,
    links.confirm ? '' : text.signature,
    links.confirm ? `${text.confirmAction}: ${links.confirm}` : '',
    links.action ? `${links.action.label}: ${links.action.url}` : '',
  ]
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
  const oneClick = new URL(links.unsubscribe);
  oneClick.pathname = '/api/email/unsubscribe';
  return {
    from: config.from,
    to: [recipient],
    reply_to: config.replyTo,
    subject: copy.subject,
    text: `${content}\n\n${footer}`,
    html: renderBrandedEmail({
      appUrl: config.appUrl,
      lang: text.lang,
      title: links.confirm ? (text.confirmTitle ?? copy.subject) : copy.subject,
      preheader: links.confirm ? (text.confirmPreheader ?? copy.preheader) : copy.preheader,
      body: copy.body,
      signature: links.confirm ? undefined : text.signature,
      action: links.confirm ? { url: links.confirm, label: text.confirmAction } : links.action,
      footerReason: links.confirm ? undefined : text.footerReason,
      identity: config.identity,
      footerLinks: [
        { url: links.preferences, label: text.preferencesLabel },
        { url: links.unsubscribe, label: text.unsubscribeLabel },
      ],
    }),
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
  return sendResendMail(payload, `mailing/${id}`, config, fetcher);
}
export async function sendResendMail(
  payload: MailPayload,
  key: string,
  config: ResendConfig,
  fetcher: typeof fetch = fetch,
): Promise<{ status: 'accepted' | 'retry' | 'failed'; providerId?: string }> {
  try {
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
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
