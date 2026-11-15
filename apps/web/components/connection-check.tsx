'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { captureBrowser } from '@/lib/analytics/browser';
import type { ConnectionCheckResult } from '@/lib/connection-check';

export function ConnectionCheck({ apiKey }: { apiKey?: string | null }) {
  const t = useTranslations('ConnectionCheck');
  const keys = useTranslations('ConnectorsPanel');
  const format = useFormatter();
  const id = useId();
  const [credential, setCredential] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<ConnectionCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function verify(token: string) {
    setIsBusy(true);
    setResult(null);
    setError(null);
    setCredential('');
    try {
      const response = await fetch('/api/connectors/verify', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { authorization: `Bearer ${token.trim()}` },
      });
      const body = await response.json();
      if (!response.ok) {
        setError(
          body.code === 'account_mismatch'
            ? t('mismatch')
            : body.code === 'insufficient_scope'
              ? t('readRequired')
              : response.status === 401
                ? t('invalid')
                : response.status === 429
                  ? t('rateLimit')
                  : t('failed'),
        );
        return;
      }
      setResult(body);
      captureBrowser('integration_key_verified', { channel: 'shared' });
    } catch {
      setError(t('failed'));
    } finally {
      setIsBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (credential.trim()) void verify(credential);
  }
  return (
    <section className="space-y-3 border-t pt-4" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="text-sm font-medium">
        {t('title')}
      </h3>
      <p className="text-xs text-muted-foreground">{t('description')}</p>
      {apiKey && (
        <Button
          variant="outline"
          type="button"
          disabled={isBusy}
          onClick={() => void verify(apiKey)}
        >
          {isBusy ? t('checking') : t('verifyNew')}
        </Button>
      )}
      <form onSubmit={submit} className="space-y-2" aria-busy={isBusy}>
        <Label htmlFor={`${id}-key`}>{t('keyLabel')}</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={`${id}-key`}
            type="password"
            value={credential}
            onChange={(event) => {
              setCredential(event.target.value);
              setResult(null);
              setError(null);
            }}
            autoComplete="off"
            spellCheck={false}
            disabled={isBusy}
            className="min-w-0 flex-1 basis-48"
            aria-describedby={`${id}-privacy`}
          />
          <Button type="submit" variant="outline" disabled={isBusy || !credential.trim()}>
            {isBusy ? t('checking') : t('verify')}
          </Button>
        </div>
        <p id={`${id}-privacy`} className="text-xs text-muted-foreground">
          {t('privacy')}
        </p>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result && (
        <div role="status" className="space-y-3 rounded-lg border p-3 text-sm">
          <p className="font-medium">{t('verified')}</p>
          <p className="text-xs text-muted-foreground">{t('scopeOfCheck')}</p>
          <dl className="grid gap-2 break-words">
            <div>
              <dt className="text-muted-foreground">{t('account')}</dt>
              <dd>
                {result.account.name} · {result.account.email}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('balance')}</dt>
              <dd>{t('credits', { count: result.balance })}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('permissions')}</dt>
              <dd>{result.key.scopes.map((scope) => keys(`keys.scopes.${scope}`)).join(', ')}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('expiry')}</dt>
              <dd>
                {result.key.expiresAt
                  ? format.dateTime(new Date(result.key.expiresAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : t('noExpiry')}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('cap')}</dt>
              <dd>
                {result.key.creditLimit === null
                  ? t('unlimited', { spent: result.key.spentCredits })
                  : t('limited', {
                      spent: result.key.spentCredits,
                      limit: result.key.creditLimit,
                      remaining: result.key.remainingCredits ?? 0,
                    })}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">{t('grossCap')}</p>
        </div>
      )}
    </section>
  );
}
