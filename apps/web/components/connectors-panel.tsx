'use client';

import type { ApiKeyScope } from '@easyrender/core';
import { KeyRound, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { type FormEvent, useId, useState } from 'react';
import { ConnectionCheck } from '@/components/connection-check';
import { McpSetup } from '@/components/mcp-setup';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { captureBrowser } from '@/lib/analytics/browser';
import { KEY_SCOPES, MAX_KEY_CREDIT_LIMIT, parseKeyRestrictions } from '@/lib/api-key-form';

export type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  scopes: ApiKeyScope[];
  creditLimit: number | null;
  spentCredits: number;
  expiresAt: string | null;
};

const ACTIVE_MS = 30 * 24 * 60 * 60 * 1000;

// MCP setup plus the API keys behind it. A new key is shown once and filled into the snippets.
export function ConnectorsPanel({ initial, mcpUrl }: { initial: KeyRow[]; mcpUrl: string }) {
  const t = useTranslations('ConnectorsPanel');
  const format = useFormatter();
  const when = (iso: string) =>
    format.dateTime(new Date(iso), { month: 'short', day: 'numeric', year: 'numeric' });
  const formId = useId();
  const [scopes, setScopes] = useState<ApiKeyScope[]>([...KEY_SCOPES]);
  const [creditLimit, setCreditLimit] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [keys, setKeys] = useState(initial);
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clearValidationError(field: string) {
    if (invalidField === field) {
      setInvalidField(null);
      setError(null);
    }
  }

  async function create(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const form = event?.currentTarget;
    const name = String((form && new FormData(form).get('name')) || t('defaultName'));
    setError(null);
    setInvalidField(null);
    const restrictions = parseKeyRestrictions({ scopes, creditLimit, expiresAt });
    if (restrictions.error) {
      setInvalidField(restrictions.error);
      setError(t(`errors.${restrictions.error}`));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, ...restrictions.value }),
      }).catch(() => null);
      if (!response?.ok) {
        setError(response?.status === 401 ? t('errors.expired') : t('errors.create'));
        return;
      }
      const { key, ...rest } = await response.json();
      captureBrowser('api_key_created');
      setCreated(key);
      setKeys((current) => [{ ...rest, lastUsedAt: null }, ...current]);
      form?.reset();
      setScopes([...KEY_SCOPES]);
      setCreditLimit('');
      setExpiresAt('');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    const response = await fetch(`/api/keys?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => null);
    if (!response?.ok) {
      setError(t('errors.revoke'));
      return;
    }
    captureBrowser('api_key_revoked');
    setKeys((current) => current.filter((key) => key.id !== id));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{t('connect.title')}</CardTitle>
          <CardDescription>
            {created
              ? t('connect.created')
              : keys.length === 0
                ? t('connect.noKeys')
                : t('connect.hasKeys', { placeholder: 'er_your_key' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {keys.length === 0 && !created && (
            <Button onClick={() => create()} disabled={busy}>
              <KeyRound />
              {t('createMyKey')}
            </Button>
          )}
          <McpSetup url={mcpUrl} apiKey={created} />
          <ConnectionCheck apiKey={created} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('keys.title')}</CardTitle>
          <CardDescription>{t('keys.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={create} className="space-y-3" aria-busy={busy}>
            <div className="space-y-2">
              <Label htmlFor={`${formId}-name`}>{t('keys.nameLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  id={`${formId}-name`}
                  name="name"
                  placeholder={t('keys.namePlaceholder')}
                  maxLength={60}
                  disabled={busy}
                />
                <Button type="submit" disabled={busy}>
                  {t('keys.create')}
                </Button>
              </div>
            </div>
            <Accordion type="single" collapsible>
              <AccordionItem value="restrictions">
                <AccordionTrigger className="py-2">{t('keys.advanced')}</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <fieldset
                    className="space-y-3"
                    disabled={busy}
                    aria-describedby={invalidField === 'scopes' ? `${formId}-error` : undefined}
                  >
                    <legend className="mb-2 text-sm font-medium">{t('keys.permissions')}</legend>
                    {KEY_SCOPES.map((scope) => (
                      <div key={scope} className="flex items-center justify-between gap-3">
                        <Label
                          htmlFor={`${formId}-${scope}`}
                          className="flex-col items-start gap-1"
                        >
                          <span>{t(`keys.scopes.${scope}`)}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {t(`keys.scopeDescriptions.${scope}`)}
                          </span>
                        </Label>
                        <Switch
                          id={`${formId}-${scope}`}
                          checked={scopes.includes(scope)}
                          disabled={busy}
                          onCheckedChange={(isChecked) => {
                            clearValidationError('scopes');
                            setScopes((current) =>
                              KEY_SCOPES.filter((item) =>
                                item === scope ? isChecked : current.includes(item),
                              ),
                            );
                          }}
                        />
                      </div>
                    ))}
                  </fieldset>
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-limit`}>{t('keys.creditLimit')}</Label>
                    <Input
                      id={`${formId}-limit`}
                      type="number"
                      min={0}
                      max={MAX_KEY_CREDIT_LIMIT}
                      step={1}
                      inputMode="numeric"
                      placeholder={t('keys.unlimited')}
                      value={creditLimit}
                      disabled={busy}
                      onChange={(event) => {
                        clearValidationError('creditLimit');
                        setCreditLimit(event.target.value);
                      }}
                      aria-invalid={invalidField === 'creditLimit'}
                      aria-describedby={`${formId}-limit-hint${invalidField === 'creditLimit' ? ` ${formId}-error` : ''}`}
                    />
                    <p id={`${formId}-limit-hint`} className="text-xs text-muted-foreground">
                      {t('keys.creditLimitHelp')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-expiry`}>{t('keys.expiresAt')}</Label>
                    <Input
                      id={`${formId}-expiry`}
                      type="datetime-local"
                      value={expiresAt}
                      disabled={busy}
                      onChange={(event) => {
                        clearValidationError('expiresAt');
                        setExpiresAt(event.target.value);
                      }}
                      aria-invalid={invalidField === 'expiresAt'}
                      aria-describedby={`${formId}-expiry-hint${invalidField === 'expiresAt' ? ` ${formId}-error` : ''}`}
                    />
                    <p id={`${formId}-expiry-hint`} className="text-xs text-muted-foreground">
                      {t('keys.expiresAtHelp')}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </form>
          {error && (
            <p id={`${formId}-error`} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <ul className="divide-y rounded-md border">
            {keys.length === 0 && (
              <li className="p-3 text-sm text-muted-foreground">{t('keys.none')}</li>
            )}
            {keys.map((key) => {
              const isExpired = Boolean(
                key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now(),
              );
              const isActive =
                !isExpired &&
                Boolean(
                  key.lastUsedAt && Date.now() - new Date(key.lastUsedAt).getTime() < ACTIVE_MS,
                );
              return (
                <li key={key.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0 space-y-0.5">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{key.name}</span>
                      <Badge
                        variant={isExpired ? 'destructive' : isActive ? 'default' : 'secondary'}
                      >
                        {isExpired
                          ? t('keys.expired')
                          : isActive
                            ? t('keys.connected')
                            : key.lastUsedAt
                              ? t('keys.idle')
                              : t('keys.neverUsed')}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <code>{key.prefix}…</code> ·{' '}
                      {t('keys.created', { date: when(key.createdAt) })}
                      {key.lastUsedAt && ` · ${t('keys.lastUsed', { date: when(key.lastUsedAt) })}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {key.scopes.map((scope) => t(`keys.scopes.${scope}`)).join(' · ')}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {key.creditLimit === null
                        ? t('keys.spentUnlimited', { spent: format.number(key.spentCredits) })
                        : t('keys.spentLimit', {
                            spent: format.number(key.spentCredits),
                            limit: format.number(key.creditLimit),
                          })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {key.expiresAt
                        ? t('keys.expiryDate', {
                            date: format.dateTime(new Date(key.expiresAt), {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZoneName: 'short',
                            }),
                          })
                        : t('keys.noExpiry')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revoke(key.id)}
                    aria-label={t('keys.revoke', { name: key.name })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
