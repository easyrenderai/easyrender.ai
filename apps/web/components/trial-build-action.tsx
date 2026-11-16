'use client';
import type { FirstModelOffer } from '@easyrender/core';
import { Box, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';

export function TrialBuildAction({
  offer,
  fallback,
  isBusy,
  next,
  onBuild,
  onRefresh,
}: {
  offer: FirstModelOffer | null | undefined;
  fallback: ReactNode;
  isBusy: boolean;
  next: string;
  onBuild: () => void;
  onRefresh: () => void;
}) {
  const t = useTranslations('FirstModel');
  const locale = useLocale();
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function verify() {
    if (!offer?.email) return;
    setIsSending(true);
    setError(null);
    try {
      const result = await authClient.sendVerificationEmail({
        email: offer.email,
        fetchOptions: { headers: { 'x-easyrender-email-locale': locale === 'es' ? 'es' : 'en' } },
      });
      if (result.error) setError(t(result.error.status === 429 ? 'rateLimited' : 'sendError'));
      else setIsSent(true);
    } catch {
      setError(t('sendError'));
    } finally {
      setIsSending(false);
    }
  }
  if (offer === undefined)
    return (
      <Button size="lg" className="w-full" disabled>
        <Loader2 className="animate-spin" />
        {t('loading')}
      </Button>
    );
  if (offer?.variant !== 'free_model' || offer.state === 'used') return fallback;
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="font-medium">{t('title')}</p>
        <p className="text-sm text-muted-foreground">{t('body')}</p>
      </div>
      {offer.state === 'signup' ? (
        <Button size="lg" className="h-auto min-h-11 w-full whitespace-normal" asChild>
          <Link href={`/sign-up?next=${next}`}>
            <Sparkles />
            {t('signup')}
          </Link>
        </Button>
      ) : offer.state === 'verify' ? (
        <>
          <p className="text-sm text-muted-foreground">{t(isSent ? 'sent' : 'verifyHint')}</p>
          <Button className="w-full" disabled={isSending || !offer.email} onClick={verify}>
            {isSending && <Loader2 className="animate-spin" />}
            {t('verify')}
          </Button>
          <Button className="w-full" variant="outline" onClick={onRefresh}>
            {t('check')}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      ) : (
        <Button
          size="lg"
          className="h-auto min-h-11 w-full whitespace-normal"
          disabled={isBusy}
          onClick={onBuild}
        >
          {isBusy ? <Loader2 className="animate-spin" /> : <Box />}
          {t('build')}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">{t('terms')}</p>
    </div>
  );
}
