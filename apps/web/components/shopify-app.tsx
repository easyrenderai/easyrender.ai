'use client';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { captureBrowser } from '@/lib/analytics/browser';

type ProductStatus =
  | 'missing'
  | 'no_photo'
  | 'queued'
  | 'building'
  | 'ready'
  | 'needs_credits'
  | 'needs_info'
  | 'failed';

type ProductRow = {
  id: string;
  title: string;
  imageUrl: string | null;
  status: ProductStatus;
  stage: 'waiting' | 'sheet' | 'final_sheet' | 'model' | 'starting_build' | null;
  error: string | null;
  isSelectable: boolean;
};

type Filter = 'all' | 'missing' | 'running' | 'ready' | 'attention';

const FILTERS: Filter[] = ['all', 'missing', 'running', 'ready', 'attention'];
const PAGE_SIZE = 50;

const FILTER_STATUSES: Record<Exclude<Filter, 'all'>, ProductStatus[]> = {
  missing: ['missing'],
  running: ['queued', 'building', 'needs_credits'],
  ready: ['ready'],
  attention: ['failed', 'needs_info', 'no_photo'],
};

type Overview =
  | { isLinked: false; linkUrl: string }
  | {
      isLinked: true;
      eligible: number;
      noPhoto: number;
      quote: { creditsPerModel: number; totalCredits: number; missingCredits: number };
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
      products: ProductRow[];
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

const IS_RUNNING: ProductStatus[] = ['queued', 'building'];

function statusVariant(status: ProductStatus) {
  if (status === 'ready') return 'default' as const;
  if (status === 'queued' || status === 'building') return 'secondary' as const;
  if (status === 'failed' || status === 'needs_info') return 'destructive' as const;
  return 'outline' as const;
}

// The app inside the Shopify admin: connect an account, see every product and whether it has a 3D
// model, tick the ones to build, see the price, generate. Ready and running products are never rebuilt.
export function ShopifyApp() {
  const t = useTranslations('ShopifyApp');
  const format = useFormatter();
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());

  // The overview is kept current while models are being made, or while the merchant connects in
  // another tab. Every poll also moves the shop's queue forward, so it stays quick while anything runs.
  const query = useQuery({
    queryKey: ['shopify-overview'],
    queryFn: () => api<Overview>('/api/shopify/overview'),
    refetchInterval: (current) => {
      const data = current.state.data;
      if (data?.isLinked === false) return 5000;
      if (data?.isLinked && data.summary.queued + data.summary.drafting + data.summary.building > 0)
        return 4000;
      return false;
    },
  });
  const overview = query.data ?? null;
  const isNotInShopify = query.error?.message === 'NOT_IN_SHOPIFY';
  const error = generateError ?? (query.error && !isNotInShopify ? query.error.message : null);

  const rows = overview?.isLinked ? overview.products : [];
  const counts = {
    all: rows.length,
    missing: rows.filter((row) => FILTER_STATUSES.missing.includes(row.status)).length,
    running: rows.filter((row) => FILTER_STATUSES.running.includes(row.status)).length,
    ready: rows.filter((row) => row.status === 'ready').length,
    attention: rows.filter((row) => FILTER_STATUSES.attention.includes(row.status)).length,
  };
  const shown =
    filter === 'all' ? rows : rows.filter((row) => FILTER_STATUSES[filter].includes(row.status));
  const selectableIds = rows.filter((row) => row.isSelectable).map((row) => row.id);
  // A product that started since it was ticked drops out of the selection by itself.
  const selectedIds = selectableIds.filter((id) => ticked.has(id));
  const selectedCount = selectedIds.length;
  const creditsPerModel = overview?.isLinked ? overview.quote.creditsPerModel : 0;
  const selectedCredits = selectedCount * creditsPerModel;
  const missingCredits = overview?.isLinked ? Math.max(0, selectedCredits - overview.balance) : 0;
  const shownSelectable = shown.filter((row) => row.isSelectable);
  const isAllShownTicked =
    shownSelectable.length > 0 && shownSelectable.every((row) => ticked.has(row.id));

  function toggle(id: string, isOn: boolean) {
    const next = new Set(ticked);
    if (isOn) next.add(id);
    else next.delete(id);
    setTicked(next);
  }

  function toggleShown(isOn: boolean) {
    const next = new Set(ticked);
    for (const row of shownSelectable) {
      if (isOn) next.add(row.id);
      else next.delete(row.id);
    }
    setTicked(next);
  }

  function changeFilter(value: string) {
    setFilter(value as Filter);
    setVisible(PAGE_SIZE);
  }

  async function generate() {
    if (!overview?.isLinked || selectedCount === 0) return;
    const approvedCredits = selectedCredits;
    const externalIds = selectedIds;
    setSent(0);
    setGenerateError(null);
    try {
      let total = 0;
      for (let isFirst = true; ; isFirst = false) {
        const result = await api<{ sent: number; remaining: number }>('/api/shopify/generate', {
          approvedCredits,
          isFirst,
          externalIds,
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
      setTicked(new Set());
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

  const withPhoto = rows.filter((row) => row.status !== 'no_photo').length;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
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
              {withPhoto > 0 && (
                <div className="space-y-2">
                  <Progress value={(counts.ready / withPhoto) * 100} />
                  <p className="text-sm tabular-nums" aria-live="polite">
                    {t('progress', {
                      ready: format.number(counts.ready),
                      running: format.number(counts.running),
                      missing: format.number(counts.missing),
                    })}
                  </p>
                </div>
              )}
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noProducts')}</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Tabs value={filter} onValueChange={changeFilter}>
                      <TabsList className="h-auto flex-wrap">
                        {FILTERS.map((value) => (
                          <TabsTrigger key={value} value={value} className="tabular-nums">
                            {t(`filter.${value}`, { count: format.number(counts[value]) })}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={selectableIds.length === 0 || sent !== null}
                        onClick={() => setTicked(new Set(selectableIds))}
                      >
                        {t('selectMissing', { count: format.number(selectableIds.length) })}
                      </Button>
                      {selectedCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setTicked(new Set())}>
                          {t('clear')}
                        </Button>
                      )}
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">
                          <Checkbox
                            aria-label={t('selectShown')}
                            checked={isAllShownTicked}
                            disabled={shownSelectable.length === 0 || sent !== null}
                            onCheckedChange={(value) => toggleShown(value === true)}
                          />
                        </TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">{t('columnPhoto')}</span>
                        </TableHead>
                        <TableHead>{t('columnProduct')}</TableHead>
                        <TableHead className="hidden text-right sm:table-cell">
                          {t('columnStatus')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shown.slice(0, visible).map((row) => (
                        <TableRow
                          key={row.id}
                          data-state={ticked.has(row.id) ? 'selected' : undefined}
                        >
                          <TableCell>
                            <Checkbox
                              aria-label={t('selectOne', { title: row.title })}
                              checked={row.isSelectable && ticked.has(row.id)}
                              disabled={!row.isSelectable || sent !== null}
                              onCheckedChange={(value) => toggle(row.id, value === true)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="size-10 overflow-hidden rounded-md border bg-muted">
                              {row.imageUrl && (
                                // biome-ignore lint/performance/noImgElement: Shopify CDN thumbnail
                                <img
                                  src={row.imageUrl}
                                  alt=""
                                  loading="lazy"
                                  className="size-full bg-white object-cover"
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-0 whitespace-normal">
                            <p className="line-clamp-2 font-medium">{row.title}</p>
                            {(row.stage || row.error) && (
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {row.stage ? t(`stage.${row.stage}`) : row.error}
                              </p>
                            )}
                            <Badge variant={statusVariant(row.status)} className="mt-1 sm:hidden">
                              {IS_RUNNING.includes(row.status) && (
                                <Loader2 className="animate-spin" />
                              )}
                              {t(`status.${row.status}`)}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden text-right sm:table-cell">
                            <Badge variant={statusVariant(row.status)}>
                              {IS_RUNNING.includes(row.status) && (
                                <Loader2 className="animate-spin" />
                              )}
                              {t(`status.${row.status}`)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {shown.length === 0 && (
                    <p className="text-sm text-muted-foreground">{t('emptyFilter')}</p>
                  )}
                  {shown.length > visible && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVisible(visible + PAGE_SIZE)}
                    >
                      {t('showMore', { count: format.number(shown.length - visible) })}
                    </Button>
                  )}
                </div>
              )}
              {rows.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <Button
                    onClick={generate}
                    disabled={sent !== null || selectedCount === 0}
                    className="h-10"
                  >
                    {sent !== null && <Loader2 className="animate-spin" />}
                    {sent !== null
                      ? t('starting', { count: format.number(sent) })
                      : selectedCount === 0
                        ? t('pickSome')
                        : t('generate', {
                            count: format.number(selectedCount),
                            credits: format.number(selectedCredits),
                          })}
                  </Button>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {t('balance', { credits: format.number(overview.balance) })}
                    {missingCredits > 0 &&
                      ` · ${t('missing', { credits: format.number(missingCredits) })}`}
                  </p>
                  {missingCredits > 0 && (
                    <Button variant="outline" size="sm" asChild>
                      <a href="/credits" target="_blank" rel="noopener noreferrer">
                        <ExternalLink />
                        {t('buy')}
                      </a>
                    </Button>
                  )}
                </div>
              )}
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
