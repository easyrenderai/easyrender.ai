import 'server-only';
import { queueServiceEmail, reportError, runServiceEmails } from '@easyrender/core';
import { after } from 'next/server';
import { DEFAULT_LOCALE, isRoutableLocale, type Locale } from '@/i18n/config';
import { authProjectPath } from '@/lib/app-locale';
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
import it from '@/messages/it.json';
import pt from '@/messages/pt.json';

export const serviceEmailTexts = {
  en: en.ServiceEmails,
  es: es.ServiceEmails,
  de: de.ServiceEmails,
  fr: fr.ServiceEmails,
  it: it.ServiceEmails,
  pt: pt.ServiceEmails,
};
export function serviceEmailLocale(request?: Request): Locale {
  const value = request?.headers.get('x-easyrender-email-locale');
  return isRoutableLocale(value) ? value : DEFAULT_LOCALE;
}
export function authServiceUrl(
  path: '/reset-password' | '/verify-email',
  token: string,
  locale: Locale,
  project?: string | null,
) {
  const base = new URL(process.env.APP_URL ?? '');
  if (
    base.username ||
    base.password ||
    (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname))
  )
    throw new Error('Invalid service email origin');
  const url = new URL(path, base.origin);
  url.searchParams.set('token', token);
  url.searchParams.set('locale', locale);
  if (project) url.searchParams.set('next', project);
  return url.href;
}
export async function queueAuthServiceEmail(
  purpose: 'verify_email' | 'reset_password',
  data: { user: { id: string; email: string }; token: string },
  request?: Request,
) {
  const locale = serviceEmailLocale(request);
  await queueServiceEmail({
    purpose,
    userId: data.user.id,
    email: data.user.email,
    locale,
    url: authServiceUrl(
      purpose === 'verify_email' ? '/verify-email' : '/reset-password',
      data.token,
      locale,
      authProjectPath(request?.headers.get('x-easyrender-project-return')),
    ),
    expiresAt: new Date(Date.now() + 3600_000),
    copy: serviceEmailTexts[locale][purpose],
  });
  after(async () => {
    try {
      await runServiceEmails(serviceEmailTexts, fetch, { userId: data.user.id, limit: 1 });
    } catch {
      reportError(new Error('Service email dispatch failed'));
    }
  });
}
