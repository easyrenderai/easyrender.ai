'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { captureBrowser } from '@/lib/analytics/browser';

type Overview =
  | { isLinked: false; linkUrl: string }
  | {
      isLinked: true;
      eligible: number;
      noPhoto: number;
      quote: { totalCredits: number; missingCredits: number } | null;
      summary: Record<
        | 'queued'
        | 'drafting'
        | 'building'
        | 'ready'
        | 'needs_credits'
        | 'needs_info'
        | 'failed'
        | 'total',
        number
      >;
      balance: number;
    };

declare global {
  interface Window {
    shopify?: { idToken: () => Promise<string> };
  }
}

// App Bridge adds window.shopify once its script has run; give it a few seconds.
async function sessionToken(): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (window.shopify) return window.shopify.idToken();
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('NOT_IN_SHOPIFY');
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${await sessionToken()}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

// The app inside the Shopify admin: connect an account, see the price, generate the catalogue.
export function ShopifyApp() {
  const t = useTranslations('ShopifyApp');
  const format = useFormatter();
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  // The overview is kept current while models are being made, or while the merchant connects in
  // another tab.
  const query = useQuery({
    queryKey: ['shopify-overview'],
    queryFn: () => api<Overview>('/api/shopify/overview'),
    refetchInterval: (current) => {
      const data = current.state.data;
      if (data?.isLinked === false) return 5000;
      if (data?.isLinked && data.summary.queued + data.summary.drafting + data.summary.building > 0)
        return 10_000;
      return false;
    },
  });
  const overview = query.data ?? null;
  const isNotInShopify = query.error?.message === 'NOT_IN_SHOPIFY';
  const error = generateError ?? (query.error && !isNotInShopify ? query.error.message : null);

  async function generate() {
    if (!overview?.isLinked || !overview.quote) return;
    const approvedCredits = overview.quote.totalCredits;
    setSent(0);
    setGenerateError(null);
    try {
      let total = 0;
      for (let isFirst = true; ; isFirst = false) {
        const result = await api<{ sent: number; remaining: number }>('/api/shopify/generate', {
          approvedCredits,
          isFirst,
        });
        total += result.sent;
        setSent(total);
        if (result.remaining === 0 || result.sent === 0) break;
      }
      if (total > 0)
        captureBrowser('shopify_generation_started', {
          item_count: total,
          credits: approvedCredits,
        });
    } catch (caught) {
      setGenerateError(caught instanceof Error ? caught.message : String(caught));
    }
    setSent(null);
    await query.refetch();
  }

  if (isNotInShopify) {
    return (
      <Alert>
        <AlertDescription>{t('notInShopify')}</AlertDescription>
      </Alert>
    );
  }
  if (!overview) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        <Loader2 className="size-4 animate-spin" />
        {error ?? t('loading')}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('intro')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{t('error', { message: error })}</AlertDescription>
            </Alert>
          )}
          {!overview.isLinked ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('connectBody')}</p>
              <Button asChild>
                <a href={overview.linkUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  {t('connectButton')}
                </a>
              </Button>
              <p className="text-sm text-muted-foreground">{t('connectWaiting')}</p>
            </div>
          ) : (
            <>
              {overview.summary.total > 0 && (
                <div className="space-y-2">
                  <Progress value={(overview.summary.ready / overview.summary.total) * 100} />
                  <p className="text-sm tabular-nums">
                    {t('progress', {
                      ready: format.number(overview.summary.ready),
                      running: format.number(overview.summary.drafting + overview.summary.building),
                      waiting: format.number(overview.summary.queued),
                    })}
                  </p>
                </div>
              )}
              {overview.eligible > 0 && overview.quote ? (
                <div className="space-y-2">
                  <Button onClick={generate} disabled={sent !== null} className="h-10">
                    {sent !== null && <Loader2 className="animate-spin" />}
                    {sent !== null
                      ? t('starting', { count: format.number(sent) })
                      : t('generate', {
                          count: format.number(overview.eligible),
                          credits: format.number(overview.quote.totalCredits),
                        })}
                  </Button>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {t('balance', { credits: format.number(overview.balance) })}
                    {overview.quote.missingCredits > 0 &&
                      ` · ${t('missing', { credits: format.number(overview.quote.missingCredits) })}`}
                  </p>
                  {overview.quote.missingCredits > 0 && (
                    <Button variant="outline" size="sm" asChild>
                      <a href="/credits" target="_blank" rel="noopener noreferrer">
                        <ExternalLink />
                        {t('buy')}
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('nothing')}</p>
              )}
              <ul className="space-y-1 text-sm text-muted-foreground tabular-nums">
                {overview.summary.needs_credits > 0 && (
                  <li>
                    {t('needsCredits', { count: format.number(overview.summary.needs_credits) })}
                  </li>
                )}
                {overview.summary.needs_info > 0 && (
                  <li>{t('needsInfo', { count: format.number(overview.summary.needs_info) })}</li>
                )}
                {overview.summary.failed > 0 && (
                  <li>{t('failed', { count: format.number(overview.summary.failed) })}</li>
                )}
                {overview.noPhoto > 0 && (
                  <li>{t('noPhoto', { count: format.number(overview.noPhoto) })}</li>
                )}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
      {overview.isLinked && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('themeTitle')}</CardTitle>
            <CardDescription>{t('themeBody')}</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
