import { getLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
export default async function SignInPage() {
  const locale = (await getLocale()) === 'es' ? 'es' : 'en';
  return (
    <Suspense>
      <AuthForm
        mode="sign-in"
        recovery={{ label: (locale === 'es' ? es : en).AuthService.forgotLink, locale }}
      />
    </Suspense>
  );
}
