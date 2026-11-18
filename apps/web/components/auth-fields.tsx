'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { cookiesPath } from '@/components/analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { isLocale } from '@/i18n/config';
import {
  attribution,
  attributionHeaders,
  captureBrowser,
  captureSignup,
} from '@/lib/analytics/browser';
import { localizedAuthPath } from '@/lib/app-locale';
import { authClient } from '@/lib/auth-client';
import { ROUTES } from '@/lib/seo/routes';

export type AuthMode = 'sign-in' | 'sign-up';

// Email and password sign up or sign in. Calls onDone once the session cookie is set.
export function AuthFields({
  mode,
  onDone,
  submitLabel,
  callbackURL,
  project,
}: {
  mode: AuthMode;
  onDone: () => void | Promise<void>;
  submitLabel?: string;
  project?: string | null;
  // Where Google sends the visitor after sign in (they leave the page, so onDone cannot run).
  callbackURL: () => string | Promise<string>;
}) {
  const t = useTranslations('Auth');
  const a = useTranslations('Analytics');
  const locale = useLocale();
  const legalLocale = isLocale(locale) ? locale : 'en';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email'));
    const password = String(form.get('password'));
    setBusy(true);
    setError(null);
    const result =
      mode === 'sign-up'
        ? await authClient.signUp.email({
            email,
            password,
            name: email.split('@')[0],
            fetchOptions: {
              body: { attribution: attribution() },
              headers: {
                ...attributionHeaders(),
                'x-easyrender-email-locale': locale,
                ...(project ? { 'x-easyrender-project-return': project } : {}),
              },
            },
          })
        : await authClient.signIn.email({ email, password });
    if (result.error) {
      setError(
        result.error.status === 429
          ? t('errors.rateLimited')
          : mode === 'sign-in' && result.error.status === 401
            ? t('errors.credentials')
            : t('errors.generic'),
      );
      setBusy(false);
      return;
    }
    captureBrowser(mode === 'sign-up' ? 'sign_up_completed' : 'sign_in_completed', {
      method: 'email',
    });
    if (mode === 'sign-up') await captureSignup();
    await onDone();
  }

  async function google() {
    setBusy(true);
    setError(null);
    const target = await callbackURL();
    const result = await authClient.signIn.social({
      provider: 'google',
      additionalData: { attribution: attribution() },
      fetchOptions: {
        headers: {
          ...attributionHeaders(),
          'x-easyrender-email-locale': locale,
        },
      },
      callbackURL: target,
      newUserCallbackURL: target,
      errorCallbackURL: `${localizedAuthPath(locale, '/sign-in')}?error=oauth&next=${encodeURIComponent(target)}`,
    });
    // On success the browser is already redirecting to Google.
    if (result.error) {
      setError(t('errors.oauth'));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        {t.rich('legalNotice', {
          terms: (chunks) => (
            <Link href={ROUTES.terms.paths[legalLocale]} className="underline underline-offset-4">
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href={ROUTES.privacy.paths[legalLocale]} className="underline underline-offset-4">
              {chunks}
            </Link>
          ),
        })}
      </p>
      <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={google}>
        <GoogleIcon />
        {t('google')}
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" />
        {t('or')}
        <Separator className="flex-1" />
      </div>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${mode}-email`}>{t('email')}</Label>
          <Input
            id={`${mode}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${mode}-password`}>{t('password')}</Label>
          <Input
            id={`${mode}-password`}
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            placeholder={t('passwordPlaceholder')}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {submitLabel ?? (mode === 'sign-up' ? t('createAccount') : t('signIn'))}
        </Button>
      </form>
      <Link href={cookiesPath(locale)} className="py-2 text-center text-xs underline">
        {a('details')}
      </Link>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
