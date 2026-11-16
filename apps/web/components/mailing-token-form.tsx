'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type en from '@/messages/en.json';

export function MailingTokenForm({
  intent,
  token,
  copy,
  uiLocale,
}: {
  intent: 'confirm' | 'unsubscribe';
  token: string;
  uiLocale: 'es' | 'en';
  copy: typeof en.MailingUI;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/email/${intent}`, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        setError(response.status === 400 ? copy.invalidLink : copy.tokenFailed);
        return;
      }
      setIsComplete(true);
      window.history.replaceState(null, '', `/email/${intent}`);
    } catch {
      setError(copy.tokenFailed);
    } finally {
      setIsBusy(false);
    }
  }
  return (
    <main lang={uiLocale} className="mx-auto w-full max-w-xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{intent === 'confirm' ? copy.confirmTitle : copy.unsubscribeTitle}</CardTitle>
          <CardDescription>
            {intent === 'confirm' ? copy.confirmDescription : copy.unsubscribeDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {isComplete ? (
            <p role="status">{intent === 'confirm' ? copy.confirmed : copy.removed}</p>
          ) : token ? (
            <form onSubmit={submit}>
              <Button type="submit" disabled={isBusy}>
                {isBusy
                  ? copy.busy
                  : intent === 'confirm'
                    ? copy.confirmButton
                    : copy.unsubscribeButton}
              </Button>
            </form>
          ) : (
            <p role="alert">{copy.invalidLink}</p>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Link href="/account" className="underline underline-offset-4">
            {copy.account}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
