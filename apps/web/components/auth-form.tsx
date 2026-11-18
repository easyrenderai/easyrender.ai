'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AuthFields, type AuthMode } from '@/components/auth-fields';
import { ReferralApplied } from '@/components/referral-applied';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authProjectPath, authReturnPath, localizedAuthPath } from '@/lib/app-locale';
import { hasPending } from '@/lib/pending-upload';

export function AuthForm({ mode, recovery }: { mode: AuthMode; recovery?: { label: string } }) {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const requested = authReturnPath(params.get('next'));
  const next = requested ?? '/dashboard';
  const other = mode === 'sign-up' ? '/sign-in' : '/sign-up';
  const project = authProjectPath(requested);
  const forgot = new URLSearchParams({ locale });
  if (project) forgot.set('next', project);

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">
          {mode === 'sign-up' ? t('signUpTitle') : t('signInTitle')}
        </CardTitle>
        <CardDescription>
          {mode === 'sign-up' ? t('signUpDescription') : t('signInDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {params.get('error') === 'oauth' && (
          <Alert variant="destructive">
            <AlertDescription>{t('errors.oauth')}</AlertDescription>
          </Alert>
        )}
        {mode === 'sign-up' && <ReferralApplied code={params.get('ref')} />}
        <AuthFields
          mode={mode}
          project={project}
          callbackURL={async () => (!requested && (await hasPending()) ? '/library' : next)}
          onDone={async () => {
            // A photo attached on the home page before signing up goes to the Library.
            router.push(!requested && (await hasPending()) ? '/library' : next);
            router.refresh();
          }}
        />
        {mode === 'sign-in' && recovery && (
          <Link
            href={`/forgot-password?${forgot}`}
            className="py-2 text-center text-sm underline underline-offset-4"
          >
            {recovery.label}
          </Link>
        )}
        <p className="text-center text-sm text-muted-foreground">
          {mode === 'sign-up' ? t('haveAccount') : t('newHere')}{' '}
          <Link
            href={`${localizedAuthPath(locale, other)}?next=${encodeURIComponent(next)}`}
            className="text-foreground underline underline-offset-4"
          >
            {mode === 'sign-up' ? t('signIn') : t('createAnAccount')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
