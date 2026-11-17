import { AppError } from '../errors';
import { renderBrandedEmail } from './template';
import type { MailPayload, ResendConfig } from './transport';

export type ServiceEmailCopy = {
  subject: string;
  body: string;
  action: string;
  title?: string;
  preheader?: string;
  notice?: string;
  footerReason?: string;
  lang?: string;
};

export function buildServiceMailPayload(
  email: string,
  url: string,
  copy: ServiceEmailCopy,
  config: ResendConfig,
): MailPayload {
  if (/[\r\n]/.test(email + copy.subject) || new URL(url).origin !== config.appUrl)
    throw new AppError('Invalid service email', 400, 'invalid_service_email');
  return {
    from: config.from,
    to: [email],
    reply_to: config.replyTo,
    subject: copy.subject,
    text: [
      copy.title,
      copy.body,
      `${copy.action}: ${url}`,
      copy.notice,
      copy.footerReason,
      config.identity,
    ]
      .filter(Boolean)
      .join('\n\n'),
    html: renderBrandedEmail({
      appUrl: config.appUrl,
      lang: copy.lang,
      title: copy.title ?? copy.subject,
      preheader: copy.preheader ?? copy.subject,
      body: copy.body,
      action: { url, label: copy.action },
      notice: copy.notice,
      footerReason: copy.footerReason,
      identity: config.identity,
    }),
    headers: {},
  };
}
