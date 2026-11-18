import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { authMetadata } from '@/lib/seo/auth';
export default async function SignInPage() {
  const t = await getTranslations('AuthService');
  return (
    <Suspense>
      <AuthForm mode="sign-in" recovery={{ label: t('forgotLink') }} />
    </Suspense>
  );
}

export async function generateMetadata() {
  return authMetadata('sign-in', 'en');
}
