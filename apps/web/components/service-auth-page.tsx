import { serviceEmailAvailable } from '@easyrender/core';
import { getLocale, getTranslations } from 'next-intl/server';
import { ServiceAuthForm } from '@/components/service-auth-form';
import { DEFAULT_LOCALE, isRoutableLocale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';
import { authProjectPath } from '@/lib/app-locale';
import { authServiceCopy } from '@/lib/auth-service-copy';

export type ServiceAuthProps = {
  searchParams: Promise<{ token?: string; error?: string; next?: string }>;
};

export async function serviceAuthMetadata(key: 'forgotTitle' | 'resetTitle' | 'verifyTitle') {
  const t = await getTranslations('AuthService');
  return {
    title: `${t(key)} · Easy Render`,
    robots: { index: false, follow: false },
    referrer: 'no-referrer' as const,
  };
}

export async function ServiceAuthPage({
  mode,
  searchParams,
}: ServiceAuthProps & { mode: 'forgot' | 'reset' | 'verify' }) {
  const [current, { token, error, next }] = await Promise.all([getLocale(), searchParams]);
  const locale = isRoutableLocale(current) ? current : DEFAULT_LOCALE;
  const project = authProjectPath(next);
  const isSignedIn =
    mode === 'verify' && project ? Boolean(await currentUser().catch(() => null)) : false;
  return (
    <ServiceAuthForm
      mode={mode}
      locale={locale}
      copy={authServiceCopy[locale]}
      token={!error && typeof token === 'string' && token.length <= 4096 ? token : ''}
      isAvailable={serviceEmailAvailable()}
      project={project}
      isSignedIn={isSignedIn}
    />
  );
}
