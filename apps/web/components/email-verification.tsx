'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HTML_LANG, type Locale } from '@/i18n/config';
import { authClient } from '@/lib/auth-client';
import type en from '@/messages/en.json';

export function EmailVerification({
  email,
  isVerified,
  isAvailable,
  copy,
  locale,
}: {
  email: string;
  isVerified: boolean;
  isAvailable: boolean;
  copy: typeof en.AuthService;
  locale: Locale;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function resend() {
    setIsBusy(true);
    setError(null);
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        fetchOptions: { headers: { 'x-easyrender-email-locale': locale } },
      });
      if (result.error) {
        setError(
          result.error.status === 429
            ? copy.rateLimited
            : result.error.status === 503
              ? copy.verificationUnavailable
              : copy.failed,
        );
        return;
      }
      setIsRequested(true);
    } catch {
      setError(copy.failed);
    } finally {
      setIsBusy(false);
    }
  }
  return (
    <Card lang={HTML_LANG[locale]}>
      <CardHeader>
        <CardTitle>{copy.verificationTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>{isVerified ? copy.verified : copy.notVerified}</p>
        {!isVerified &&
          (isAvailable ? (
            <Button
              type="button"
              onClick={resend}
              disabled={isBusy}
              className="h-auto min-h-9 whitespace-normal"
            >
              {isBusy ? copy.busy : copy.resend}
            </Button>
          ) : (
            <p>{copy.verificationUnavailable}</p>
          ))}
        {isRequested && <p role="status">{copy.verificationSent}</p>}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
