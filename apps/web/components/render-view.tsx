'use client';

import type { FirstModelOffer, RenderEditView, RenderView as View } from '@easyrender/core';
import { Box, Globe, Grid3x3, Loader2, Lock, RefreshCw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { ShellPanel } from '@/components/app-shell/shell-context';
import { ModelView } from '@/components/model-view';
import { DATE_FORMAT, RenderDetail } from '@/components/render-detail';
import { RenderHistory } from '@/components/render-history';
import { RenderJourneyStatus } from '@/components/render-journey-status';
import { TrialBuildAction } from '@/components/trial-build-action';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { UpscaleAction } from '@/components/upscale/upscale-action';
import { latestUpscale, useUpscales } from '@/components/upscale/use-upscales';
import { captureBrowser, observeRender } from '@/lib/analytics/browser';

import { startRenderPolling } from '@/lib/render-polling';
import { correctionNote, SHEET_ISSUES, type SheetIssue } from '@/lib/sheet-correction';

const RUNNING = new Set(['drafting', 'rendering']);
// Mirrors MAX_NOTE_LENGTH in the harness, which a client component cannot import (it pulls in sharp).
const NOTE_MAX_LENGTH = 500;

export function RenderView({
  initial,
  edits,
  now,
  signedIn,
  balance,
  owner,
  canExport = false,
}: {
  initial: View;
  // The owner's history of this render, read on the server. A new step refreshes it.
  edits: RenderEditView[];
  now: number;
  signedIn: boolean;
  balance: number;
  owner: boolean;
  /** The deployment can convert models to OBJ, FBX and BLEND. */
  canExport?: boolean;
}) {
  const t = useTranslations('Render');
  const trialText = useTranslations('FirstModel');
  const [trialOffer, setTrialOffer] = useState<FirstModelOffer | null | undefined>(undefined);
  const [trialRefresh, setTrialRefresh] = useState(0);
  const [hasTrialError, setHasTrialError] = useState(false);
  const format = useFormatter();
  const router = useRouter();
  const [render, setRender] = useState(initial);
  const [hasConnectionError, setHasConnectionError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [redrawError, setRedrawError] = useState<string | null>(null);
  const [note, setNote] = useState(initial.sheetNote ?? '');
  const [issues, setIssues] = useState<SheetIssue[]>([]);
  const [isConfirmingCorrection, setIsConfirmingCorrection] = useState(false);
  const correction = correctionNote(
    issues.map((issue) => t(`correction.instructions.${issue}`)),
    note,
  );
  const isCorrectionValid = correction.length > 0 && correction.length <= NOTE_MAX_LENGTH;
  const upscales = useUpscales({ renderId: initial.id }, owner && signedIn && initial.canUpscale);

  useEffect(() => {
    if (!RUNNING.has(render.status)) return;
    return startRenderPolling(render.id, setRender, setHasConnectionError);
  }, [render.id, render.status]);

  useEffect(() => {
    if (owner) observeRender(render);
  }, [render, owner]);

  useEffect(() => {
    if (!owner || render.status !== 'preview_ready') return;
    const controller = new AbortController();
    setHasTrialError(false);
    if (trialRefresh > 0) setTrialOffer(undefined);
    fetch(`/api/renders/${render.id}/trial`, { method: 'POST', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Offer unavailable');
        return response.json() as Promise<FirstModelOffer | null>;
      })
      .then((offer) => {
        if (!controller.signal.aborted) setTrialOffer(offer);
      })
      .catch(() => {
        if (!controller.signal.aborted) setHasTrialError(true);
      });
    return () => controller.abort();
  }, [owner, render.id, render.status, trialRefresh]);

  async function build(isUsingFreeModel = false) {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch(`/api/renders/${render.id}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          isUsingFreeModel ? { useFreeModel: true, maxCredits: 0 } : { maxCredits: owed },
        ),
      });
      const data = await response.json();
      if (response.ok) {
        setRender(data);
        router.refresh();
        captureBrowser('render_generation_started', {
          source: 'render_detail',
          credits: isUsingFreeModel ? 0 : owed,
        });
      } else setError(data.error ?? t('errors.start'));
    } catch {
      setError(t('errors.start'));
    } finally {
      setStarting(false);
    }
  }

  async function makeSheet() {
    setStarting(true);
    setError(null);
    const response = await fetch(`/api/renders/${render.id}/sheet`, { method: 'POST' });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setRender(data);
      router.refresh();
      captureBrowser('render_sheet_generation_started', {
        source: 'render_detail',
        credits: render.sheetCredits,
      });
    } else setError(data.error ?? t('errors.sheet'));
    setStarting(false);
  }

  async function redrawSheet() {
    if (!isCorrectionValid || starting) return;
    setStarting(true);
    setRedrawError(null);
    const response = await fetch(`/api/renders/${render.id}/sheet/redraw`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note: correction }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setIsConfirmingCorrection(false);
      setRender(data);
      router.refresh();
      captureBrowser('render_sheet_redraw_started', {
        source: 'render_detail',
        credits: render.sheetCredits,
      });
    } else setRedrawError(data.error ?? t('errors.redraw'));
    setStarting(false);
  }

  async function setPublic(isPublic: boolean) {
    setSaving(true);
    const response = await fetch(`/api/renders/${render.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isPublic }),
    });
    if (response.ok) {
      setRender(await response.json());
      captureBrowser('render_visibility_changed', { is_public: isPublic });
    }
    setSaving(false);
  }

  // An angle sheet bought earlier already counts toward the price.
  const owed = Math.max(0, render.renderCredits - render.credits);
  const base = `/api/renders/${render.id}`;
  const next = encodeURIComponent(`/r/${render.id}`);
  const title = render.name || render.prompt || t('untitled');

  const viewer =
    render.status === 'ready' ? (
      <ModelView
        src={`${base}/model?v=${render.modelVersion}`}
        name={render.id}
        downloadUrl={owner ? `${base}/model?download=1` : null}
        exportsUrl={owner && signedIn && canExport ? `${base}/exports` : null}
        editableRenderId={owner ? render.id : undefined}
        nextStepsHref={owner ? (signedIn ? '/dashboard' : '/#try') : undefined}
      />
    ) : (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-xl border bg-muted/40 p-6 text-center text-muted-foreground sm:aspect-[4/3]">
        {render.status === 'failed' ? (
          <p className="text-sm">{render.error}</p>
        ) : RUNNING.has(render.status) ? (
          <>
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">
              {render.status === 'drafting' ? t('drafting') : t('rendering')}
            </p>
          </>
        ) : (
          <>
            <Box className="size-8" />
            <p className="max-w-sm text-sm">{t('previewReady')}</p>
          </>
        )}
      </div>
    );

  const isFixable = owner && signedIn && render.status === 'preview_ready' && render.hasSheet;
  const sheet = render.hasPreview ? (
    // biome-ignore lint/performance/noImgElement: watermarked preview served by our own API
    <img
      src={`${base}/preview?v=${render.modelVersion}`}
      alt={t('previewAlt')}
      className="w-full rounded-lg border bg-white"
    />
  ) : (
    <div className="flex aspect-square w-full items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
      {render.status === 'failed' ? (
        <span className="text-sm">{t('noPreview')}</span>
      ) : (
        <Loader2 className="size-5 animate-spin" />
      )}
    </div>
  );

  const angles = (
    <div className="space-y-4">
      {sheet}
      {owner && render.status === 'preview_ready' && render.hasSheet && (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">{t('review.title')}</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {(['shape', 'parts', 'openings'] as const).map((key) => (
              <li key={key}>{t(`review.${key}`)}</li>
            ))}
          </ul>
        </details>
      )}
      {owner && signedIn && render.canUpscale && (
        <div className="space-y-2">
          <UpscaleAction
            row={latestUpscale(upscales.rows, (row) => row.kind === 'sheet')}
            credits={render.upscaleCredits}
            balance={balance}
            isBusy={upscales.busyKey === 'sheet'}
            buyHref={`/credits?next=${next}`}
            onStart={() =>
              upscales.start({ kind: 'sheet', renderId: render.id }, 'sheet', t('errors.upscale'))
            }
          />
          {upscales.error && (
            <Alert variant="destructive">
              <AlertDescription>{upscales.error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
      {isFixable && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">{t('fixSheetLabel')}</summary>
          <div className="mt-4 space-y-2">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('correction.title')}</legend>
              <p className="text-xs text-muted-foreground">{t('correction.multiple')}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {SHEET_ISSUES.map((issue) => (
                  <Label key={issue} className="min-h-11 cursor-pointer gap-2">
                    <Checkbox
                      checked={issues.includes(issue)}
                      disabled={starting}
                      onCheckedChange={(checked) =>
                        setIssues((current) =>
                          checked === true
                            ? [...current.filter((key) => key !== issue), issue]
                            : current.filter((key) => key !== issue),
                        )
                      }
                    />
                    {t(`correction.labels.${issue}`)}
                  </Label>
                ))}
              </div>
            </fieldset>
            <Label htmlFor="sheet-note">{t('fixSheetLabel')}</Label>
            <Textarea
              id="sheet-note"
              value={note}
              maxLength={NOTE_MAX_LENGTH}
              rows={3}
              placeholder={t('fixSheetPlaceholder')}
              onChange={(event) => setNote(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('fixSheetHint')}</p>
            {correction.length > NOTE_MAX_LENGTH && (
              <p role="alert" className="text-sm text-destructive">
                {t('correction.tooLong', { max: NOTE_MAX_LENGTH })}
              </p>
            )}
            {balance < render.sheetCredits ? (
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/credits?next=${next}`}>{t('buyToRedraw')}</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setIsConfirmingCorrection(true)}
                disabled={starting || !isCorrectionValid}
              >
                {starting ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {t('correction.review')}
              </Button>
            )}
            <Dialog open={isConfirmingCorrection} onOpenChange={setIsConfirmingCorrection}>
              <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t('correction.confirmTitle')}</DialogTitle>
                  <DialogDescription>
                    {t('correction.confirmBody', { credits: render.sheetCredits })}
                  </DialogDescription>
                </DialogHeader>
                <p className="text-sm break-words whitespace-pre-wrap">{correction}</p>
                {redrawError && (
                  <p role="alert" className="text-sm text-destructive">
                    {redrawError}
                  </p>
                )}
                <DialogFooter>
                  <Button
                    variant="outline"
                    disabled={starting}
                    onClick={() => setIsConfirmingCorrection(false)}
                  >
                    {t('correction.back')}
                  </Button>
                  <Button disabled={starting || !isCorrectionValid} onClick={redrawSheet}>
                    {starting && <Loader2 className="animate-spin" />}
                    {t('redrawSheet', { credits: render.sheetCredits })}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {redrawError && (
              <Alert variant="destructive">
                <AlertDescription>{redrawError}</AlertDescription>
              </Alert>
            )}
          </div>
        </details>
      )}
    </div>
  );

  const actions = owner ? (
    <>
      {render.status === 'preview_ready' &&
        (hasTrialError ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-muted-foreground">
              {trialText('loadError')}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setTrialRefresh((n) => n + 1)}
            >
              {trialText('retry')}
            </Button>
          </div>
        ) : (
          <TrialBuildAction
            offer={trialOffer}
            isBusy={starting}
            next={next}
            onBuild={() => build(true)}
            onRefresh={() => setTrialRefresh((n) => n + 1)}
            fallback={
              <>
                {render.status === 'preview_ready' && (
                  <p className="text-sm text-muted-foreground">
                    {t('journey.buildCost', { credits: owed })}
                  </p>
                )}
                {render.status === 'preview_ready' &&
                  (!signedIn ? (
                    <Button size="lg" className="w-full" asChild>
                      <Link href={`/sign-up?next=${next}`}>
                        <Sparkles />
                        {t('signUpToRender')}
                      </Link>
                    </Button>
                  ) : balance < owed ? (
                    <Button size="lg" className="w-full" asChild>
                      <Link href={`/credits?next=${next}`}>{t('buyToRender')}</Link>
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => build()}
                      disabled={starting}
                    >
                      {starting ? <Loader2 className="animate-spin" /> : <Box />}
                      {t('render3d', { credits: owed })}
                    </Button>
                  ))}
              </>
            }
          />
        ))}
      {render.status === 'preview_ready' &&
        signedIn &&
        !render.hasSheet &&
        balance >= render.sheetCredits && (
          <Button variant="outline" className="w-full" onClick={makeSheet} disabled={starting}>
            {starting ? <Loader2 className="animate-spin" /> : <Grid3x3 />}
            {t('generateSheet', { credits: render.sheetCredits })}
          </Button>
        )}
      {render.status === 'failed' && (
        <Button variant="outline" className="w-full" asChild>
          <Link href="/">{t('tryAnother')}</Link>
        </Button>
      )}
      {signedIn && render.status !== 'failed' && (
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <Label htmlFor="public" className="flex-col items-start gap-1">
            <span>{t('showInGallery')}</span>
            <span className="text-xs font-normal text-muted-foreground">{t('finishedOnly')}</span>
          </Label>
          <Switch
            id="public"
            checked={render.isPublic}
            disabled={saving}
            onCheckedChange={setPublic}
          />
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  ) : (
    <Button className="w-full" asChild>
      <Link href="/#top">
        <Sparkles />
        {t('makeYourOwn')}
      </Link>
    </Button>
  );

  return (
    <>
      <RenderDetail
        isInApp={signedIn}
        isReviewingAngles={render.status === 'preview_ready'}
        activity={
          owner ? (
            <RenderJourneyStatus
              status={render.status}
              hasPreview={render.hasPreview}
              hasConnectionError={hasConnectionError}
            />
          ) : undefined
        }
        title={title}
        prompt={render.prompt}
        badges={[t(`status.${render.status}`)]}
        viewer={viewer}
        isViewerFirst={render.status === 'ready'}
        input={`${base}/source`}
        angles={angles}
        meta={[
          {
            label: t('meta.status'),
            value: (
              <span className="inline-flex items-center gap-1.5">
                {RUNNING.has(render.status) && <Loader2 className="size-3.5 animate-spin" />}
                {t(`status.${render.status}`)}
              </span>
            ),
          },
          { label: t('meta.formats'), value: 'GLB · USDZ' },
          ...(owner
            ? [{ label: t('meta.creditsUsed'), value: format.number(render.credits) }]
            : []),
          {
            label: t('meta.visibility'),
            value: (
              <span className="inline-flex items-center gap-1.5">
                {render.isPublic ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
                {render.isPublic ? t('public') : t('private')}
              </span>
            ),
          },
          {
            label: t('meta.created'),
            value: format.dateTime(new Date(render.createdAt), DATE_FORMAT),
          },
        ]}
        actions={actions}
      />
      {signedIn && owner && (
        <ShellPanel side="left">
          <RenderHistory edits={edits} now={now} />
        </ShellPanel>
      )}
    </>
  );
}
