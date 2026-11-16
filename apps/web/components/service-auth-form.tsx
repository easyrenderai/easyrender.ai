'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/lib/auth-client';
import type en from '@/messages/en.json';

export function ServiceAuthForm({
  mode,
  token,
  copy,
  locale,
  isAvailable,
}: {
  mode: 'forgot' | 'reset' | 'verify';
  token: string;
  copy: typeof en.AuthService;
  locale: 'es' | 'en';
  isAvailable: boolean;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    if (mode === 'reset' && password !== String(form.get('confirmPassword') ?? '')) {
      setError(copy.passwordMismatch);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      let status = 200;
      if (mode === 'forgot') {
        const result = await authClient.requestPasswordReset({
          email: String(form.get('email') ?? ''),
          fetchOptions: { headers: { 'x-easyrender-email-locale': locale } },
        });
        status = result.error?.status ?? 200;
      } else if (mode === 'reset') {
        const result = await authClient.resetPassword({ token, newPassword: password });
        status = result.error?.status ?? 200;
      } else {
        const response = await fetch('/api/email/verify-account', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
          credentials: 'omit',
        });
        status = response.status;
      }
      if (status >= 400) {
        setError(
          status === 429
            ? copy.rateLimited
            : status === 503
              ? copy.unavailable
              : mode !== 'forgot' && status < 500
                ? copy.invalidLink
                : copy.failed,
        );
        return;
      }
      setIsComplete(true);
      if (mode !== 'forgot')
        window.history.replaceState(
          null,
          '',
          `/${mode === 'verify' ? 'verify-email' : 'reset-password'}?locale=${locale}`,
        );
    } catch {
      setError(copy.failed);
    } finally {
      setIsBusy(false);
    }
  }
  const hasInvalidToken = mode !== 'forgot' && !token;
  return (
    <main lang={locale} className="mx-auto w-full max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>
            {mode === 'forgot'
              ? copy.forgotTitle
              : mode === 'reset'
                ? copy.resetTitle
                : copy.verifyTitle}
          </CardTitle>
          <CardDescription>
            {mode === 'forgot'
              ? copy.forgotDescription
              : mode === 'reset'
                ? copy.resetDescription
                : copy.verifyDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {isComplete ? (
            <p role="status">
              {mode === 'forgot'
                ? copy.requested
                : mode === 'reset'
                  ? copy.resetDone
                  : copy.verifyDone}
            </p>
          ) : hasInvalidToken ? (
            <p role="alert">{copy.invalidLink}</p>
          ) : mode === 'forgot' && !isAvailable ? (
            <p role="alert">{copy.unavailable}</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {mode === 'forgot' && (
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">{copy.email}</Label>
                  <Input
                    id="recovery-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={isBusy}
                  />
                </div>
              )}
              {mode === 'reset' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">{copy.password}</Label>
                    <Input
                      id="new-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      disabled={isBusy}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">{copy.confirmPassword}</Label>
                    <Input
                      id="confirm-password"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={128}
                      disabled={isBusy}
                    />
                  </div>
                </>
              )}
              <Button type="submit" className="h-auto min-h-9 whitespace-normal" disabled={isBusy}>
                {isBusy
                  ? copy.busy
                  : mode === 'forgot'
                    ? copy.requestReset
                    : mode === 'reset'
                      ? copy.resetAction
                      : copy.verifyAction}
              </Button>
            </form>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {mode === 'reset' && (hasInvalidToken || error) && (
              <Link
                href={`/forgot-password?locale=${locale}`}
                className="underline underline-offset-4"
              >
                {copy.newLink}
              </Link>
            )}
            <Link
              href={mode === 'verify' ? '/account' : '/sign-in'}
              className="underline underline-offset-4"
            >
              {mode === 'verify' ? copy.account : copy.signIn}
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
