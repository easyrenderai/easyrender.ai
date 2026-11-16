'use client';

import type { ViewSetView } from '@easyrender/core';
import {
  Box,
  Download,
  FolderDown,
  Loader2,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { UpscaleAction } from '@/components/upscale/upscale-action';
import { latestUpscale, useUpscales } from '@/components/upscale/use-upscales';

const RUNNING = new Set(['drafting', 'processing']);
// Mirrors MAX_NOTE_LENGTH in the harness, which a client component cannot import (it pulls in sharp).
const NOTE_MAX_LENGTH = 500;

export function ProductViewsDetail({
  initial,
  balance,
}: {
  initial: ViewSetView;
  balance: number;
}) {
  const t = useTranslations('ProductViews');
  const format = useFormatter();
  const router = useRouter();
  const [set, setSet] = useState(initial);
  const [polishing, setPolishing] = useState<ViewSetView['views'][number]['view'] | null>(null);
  const [note, setNote] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const base = `/api/product-views/${set.id}`;
  const upscales = useUpscales({ viewSetId: set.id }, set.status === 'ready');

  useEffect(() => {
    if (!RUNNING.has(set.status)) return;
    const timer = setInterval(async () => {
      const response = await fetch(base, { cache: 'no-store' });
      if (response.ok) setSet(await response.json());
    }, 3000);
    return () => clearInterval(timer);
  }, [base, set.status]);

  async function polish() {
    if (!polishing) return;
    setIsBusy(true);
    setDialogError(null);
    const response = await fetch(`${base}/views/${polishing}/polish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setSet(data);
      setPolishing(null);
      setNote('');
    } else setDialogError(data.error ?? t('errors.polish'));
    setIsBusy(false);
  }

  async function buildThreeD() {
    setIsBusy(true);
    setError(null);
    const response = await fetch(`${base}/render`, { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      router.push(`/r/${data.renderId}`);
      return;
    }
    setError(data.error ?? t('errors.render'));
    setIsBusy(false);
  }

  const isReady = set.status === 'ready';
  const canPolish = isReady && balance >= set.polishCredits;
  const title = set.name || t('untitled');

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{t('canvas')}</p>
        </div>
        {set.readyCount > 0 && (
          <Button asChild>
            <a href={`${base}/zip`}>
              <FolderDown />
              {t('downloadAll')}
            </a>
          </Button>
        )}
      </div>

      {set.status === 'failed' && (
        <Alert variant="destructive">
          <AlertDescription>{t('failed')}</AlertDescription>
        </Alert>
      )}

      {RUNNING.has(set.status) && (
        <div className="space-y-2 rounded-lg border p-4">
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            {set.status === 'drafting'
              ? t('status.drafting')
              : t('status.processing', { ready: set.readyCount, total: set.viewCount })}
          </p>
          <Progress value={(set.readyCount / set.viewCount) * 100} />
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {set.views.map((view) => (
          <li key={view.view}>
            <Card className="gap-0 overflow-hidden py-0">
              <div className="relative flex aspect-square items-center justify-center bg-white">
                {view.hasImage ? (
                  // biome-ignore lint/performance/noImgElement: finished view served by our own API
                  <img
                    src={`${base}/views/${view.view}?v=${view.version}`}
                    alt={t(`views.${view.view}`)}
                    className="size-full object-contain"
                  />
                ) : (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                )}
                {view.hasImage && view.status !== 'ready' && (
                  <Badge variant="secondary" className="absolute top-2 left-2">
                    <Loader2 className="animate-spin" />
                    {t(view.status === 'upscaling' ? 'status.upscaling' : 'status.redrawing')}
                  </Badge>
                )}
                {view.isFlagged && (
                  <Badge variant="outline" className="absolute top-2 left-2 bg-background">
                    <TriangleAlert />
                    {t('flagged')}
                  </Badge>
                )}
              </div>
              <CardContent className="space-y-2 p-3">
                <p className="text-sm font-medium">{t(`views.${view.view}`)}</p>
                {view.isFlagged && (
                  <p className="text-xs text-muted-foreground">
                    {view.problems.map((problem) => t(`problems.${problem}`)).join(', ')}
                  </p>
                )}
                <div className="flex gap-2">
                  {view.hasImage && (
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <a href={`${base}/views/${view.view}?download=1`}>
                        <Download />
                        {t('download')}
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={!canPolish || view.status !== 'ready'}
                    onClick={() => {
                      setPolishing(view.view);
                      setNote(view.note ?? '');
                      setDialogError(null);
                    }}
                  >
                    <RefreshCw />
                    {t('polish')}
                  </Button>
                </div>
                {view.hasImage && view.status === 'ready' && (
                  <UpscaleAction
                    row={latestUpscale(
                      upscales.rows,
                      (row) => row.kind === 'view' && row.view === view.view,
                    )}
                    credits={set.upscaleCredits}
                    balance={balance}
                    isBusy={upscales.busyKey === view.view}
                    buyHref={`/credits?next=/views/${set.id}`}
                    onStart={() =>
                      upscales.start(
                        { kind: 'view', viewSetId: set.id, view: view.view },
                        view.view,
                        t('errors.upscale'),
                      )
                    }
                  />
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">{t('aiNote')}</p>

      {isReady && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <Box className="size-4" />
                {t('upsellTitle')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('upsellBody')}</p>
            </div>
            {set.renderId ? (
              <Button variant="outline" asChild>
                <Link href={`/r/${set.renderId}`}>{t('openRender')}</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={buildThreeD} disabled={isBusy}>
                {isBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {t('build3d', { credits: format.number(set.buildCredits) })}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      {(error || upscales.error) && (
        <Alert variant="destructive">
          <AlertDescription>{error ?? upscales.error}</AlertDescription>
        </Alert>
      )}
      {isReady && balance < set.polishCredits && (
        <Button variant="outline" asChild>
          <Link href={`/credits?next=/views/${set.id}`}>{t('buyToPolish')}</Link>
        </Button>
      )}

      <Dialog open={polishing !== null} onOpenChange={(open) => !open && setPolishing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {polishing ? t('polishTitle', { view: t(`views.${polishing}`) }) : ''}
            </DialogTitle>
            <DialogDescription>{t('polishHint')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="polish-note">{t('polishLabel')}</Label>
            <Textarea
              id="polish-note"
              rows={3}
              value={note}
              maxLength={NOTE_MAX_LENGTH}
              placeholder={t('polishPlaceholder')}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          {dialogError && (
            <Alert variant="destructive">
              <AlertDescription>{dialogError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button onClick={polish} disabled={isBusy || note.trim().length === 0}>
              {isBusy ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {t('polishSubmit', { credits: format.number(set.polishCredits) })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
