import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { noindexMetadata } from './metadata';
import { SITE_NAME } from './site';

export async function authMetadata(kind: 'sign-in' | 'sign-up', locale: Locale) {
  const t = await getTranslations({ locale, namespace: 'Auth' });
  return noindexMetadata(`${t(kind === 'sign-in' ? 'metaSignIn' : 'metaSignUp')} · ${SITE_NAME}`);
}
