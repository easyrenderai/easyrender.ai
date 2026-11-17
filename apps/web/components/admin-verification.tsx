'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { startAdminGoogleRecovery } from '@/lib/admin-analytics/google-recovery';
import type en from '@/messages/en.json';

export function AdminVerification({
  email,
  next,
  locale,
  hasGoogleAccount,
  isGoogleAvailable,
  hasOAuthError,
  copy,
}: {
  email: string;
  next: string;
  locale: 'en' | 'es';
  hasGoogleAccount: boolean;
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
      const result = await startAdminGoogleRecovery(hasGoogleAccount, next, locale);
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
        {isGoogleAvailable && (
          <p className="text-sm text-muted-foreground">
            {hasGoogleAccount ? copy.linkedInstructions : copy.instructions}
          </p>
        )}
        {hasError && (
          <Alert variant="destructive">
            <AlertDescription>{copy.error}</AlertDescription>
          </Alert>
        )}
        {isGoogleAvailable ? (
          <Button className="w-full" onClick={google} disabled={isBusy} aria-busy={isBusy}>
            {isBusy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isBusy ? copy.connecting : hasGoogleAccount ? copy.verifyGoogle : copy.google}
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
