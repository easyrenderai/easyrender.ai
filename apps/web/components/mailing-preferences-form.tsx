'use client';

import type { mailingStatus } from '@easyrender/core';
import Link from 'next/link';
import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type en from '@/messages/en.json';

type Status = Awaited<ReturnType<typeof mailingStatus>>;
export function MailingPreferencesForm({
  initial,
  copy,
  uiLocale,
}: {
  initial: Status;
  copy: typeof en.MailingUI;
  uiLocale: 'es' | 'en';
}) {
  const [status, setStatus] = useState(initial);
  const [locale, setLocale] = useState<'es' | 'en' | null>(null);
  const [isConsenting, setIsConsenting] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const consentId = useId();
  const isSubscribed =
    status.status === 'active' || status.status === 'pending' || status.status === 'held';
  const isExpired = Date.parse(status.expiresAt) <= Date.now();
  const canSubscribe =
    status.isAvailable && !isExpired && !isSubscribed && status.status !== 'suppressed';
  const message = isExpired
    ? copy.expired
    : status.status === 'active'
      ? copy.active
      : status.status === 'pending'
        ? copy.pending
        : status.status === 'suppressed' || status.status === 'held'
          ? copy.suppressed
          : status.status === 'unsubscribed'
            ? copy.unsubscribed
            : copy.none;

  const canResend =
    status.status === 'pending' &&
    status.isAvailable &&
    !isExpired &&
    (status.locale === 'es' || status.locale === 'en');
  async function submit(intent: 'subscribe' | 'unsubscribe', isResend = false) {
    if (
      intent === 'subscribe' &&
      (isResend ? !canResend : !isConsenting || !locale || !canSubscribe)
    )
      return;
    const requestedLocale = isResend ? status.locale : locale;
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/email/preferences', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          intent,
          locale: requestedLocale,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? copy.rateLimited : copy.failed);
        return;
      }
      const next: Status = await response.json();
      setStatus(next);
      setIsConsenting(false);
      setLocale(null);
    } catch {
      setError(copy.failed);
    } finally {
      setIsBusy(false);
    }
  }
  function requestSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit('subscribe');
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>{copy.scope}</p>
        <p role="status" aria-live="polite">
          {message}
        </p>
        {!isExpired && (
          <p className="text-muted-foreground">
            {copy.expires.replace(
              '{date}',
              new Date(status.expiresAt).toLocaleDateString(uiLocale),
            )}
          </p>
        )}
        {canSubscribe && (
          <form onSubmit={requestSubscription} className="space-y-4">
            <fieldset className="space-y-2" disabled={isBusy}>
              <legend className="font-medium">{copy.language}</legend>
              <p className="text-muted-foreground">{copy.languagesOnly}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={locale === 'es' ? 'secondary' : 'outline'}
                  aria-pressed={locale === 'es'}
                  onClick={() => setLocale('es')}
                >
                  {copy.spanish}
                </Button>
                <Button
                  type="button"
                  variant={locale === 'en' ? 'secondary' : 'outline'}
                  aria-pressed={locale === 'en'}
                  onClick={() => setLocale('en')}
                >
                  {copy.english}
                </Button>
              </div>
            </fieldset>
            <div className="flex items-start gap-3">
              <Switch
                id={consentId}
                checked={isConsenting}
                onCheckedChange={setIsConsenting}
                disabled={isBusy}
              />
              <Label htmlFor={consentId} className="leading-relaxed">
                {copy.consent}
              </Label>
            </div>
            <Button type="submit" disabled={isBusy || !locale || !isConsenting}>
              {isBusy ? copy.busy : copy.subscribe}
            </Button>
          </form>
        )}
        {canResend && (
          <div className="space-y-2">
            <p className="text-muted-foreground">
              {copy.requestedLanguage.replace(
                '{language}',
                status.locale === 'es' ? copy.spanish : copy.english,
              )}
            </p>
            <Button type="button" disabled={isBusy} onClick={() => void submit('subscribe', true)}>
              {isBusy ? copy.busy : copy.resend}
            </Button>
          </div>
        )}
        {isSubscribed && (
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => void submit('unsubscribe')}
          >
            {isBusy ? copy.busy : copy.stop}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <Link
          className="text-muted-foreground underline underline-offset-4"
          href={uiLocale === 'es' ? '/es/privacidad' : '/privacy'}
        >
          {copy.privacy}
        </Link>
      </CardContent>
    </Card>
  );
}
