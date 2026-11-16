import 'server-only';
import { queueServiceEmail, reportError, runServiceEmails } from '@easyrender/core';
import { after } from 'next/server';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

export const serviceEmailTexts = { en: en.ServiceEmails, es: es.ServiceEmails };
export function serviceEmailLocale(request?: Request): 'es' | 'en' {
  return request?.headers.get('x-easyrender-email-locale') === 'es' ? 'es' : 'en';
}
export function authServiceUrl(
  path: '/reset-password' | '/verify-email',
  token: string,
  locale: 'es' | 'en',
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
