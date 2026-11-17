'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { adminReturnPath, adminVerificationPath } from '@/lib/admin-analytics/navigation';
import { authClient } from '@/lib/auth-client';
import type en from '@/messages/en.json';

export function AdminVerification({
  email,
  next,
  locale,
  isGoogleAvailable,
  hasOAuthError,
  copy,
}: {
  email: string;
  next: string;
  locale: 'en' | 'es';
  isGoogleAvailable: boolean;
  hasOAuthError: boolean;
  copy: typeof en.AuthService.adminAccess;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [hasError, setHasError] = useState(hasOAuthError);

  async function google() {
    setIsBusy(true);
    setHasError(false);
    try {
      const target = adminReturnPath(next);
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: target,
        newUserCallbackURL: target,
        errorCallbackURL: `${adminVerificationPath(target)}&locale=${locale}`,
      });
      if (result.error) {
        setHasError(true);
        setIsBusy(false);
      }
    } catch {
      setHasError(true);
      setIsBusy(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-sm" lang={locale}>
      <CardHeader>
        <CardTitle className="text-xl">{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1 text-sm">
          <p className="text-muted-foreground">{copy.account}</p>
          <p className="break-all font-medium">{email}</p>
        </div>
        {isGoogleAvailable && <p className="text-sm text-muted-foreground">{copy.instructions}</p>}
        {hasError && (
          <Alert variant="destructive">
            <AlertDescription>{copy.error}</AlertDescription>
          </Alert>
        )}
        {isGoogleAvailable ? (
          <Button className="w-full" onClick={google} disabled={isBusy} aria-busy={isBusy}>
            {isBusy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isBusy ? copy.connecting : copy.google}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{copy.googleUnavailable}</p>
        )}
        <Link href="/account" className="text-center text-sm underline underline-offset-4">
          {copy.manageAccount}
        </Link>
      </CardContent>
    </Card>
  );
}
