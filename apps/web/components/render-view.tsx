'use client';

import type { FirstModelOffer, RenderEditView, RenderView as View } from '@easyrender/core';
import type { BuildQuality } from '@easyrender/harness/pricing';
import { useQuery } from '@tanstack/react-query';
import { Box, Download, Globe, Grid3x3, Loader2, Lock, RefreshCw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { AngleSheet } from '@/components/angle-sheet';
import { ShellPanel } from '@/components/app-shell/shell-context';
import { BuildQualityPicker } from '@/components/build-quality-picker';
import { ModelView } from '@/components/model-view';
import { DATE_FORMAT, RenderDetail } from '@/components/render-detail';
import { RenderHistory } from '@/components/render-history';
import { RenderJourneyStatus } from '@/components/render-journey-status';
import { SiteLink } from '@/components/site-link';
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
import { isLocale } from '@/i18n/config';
import { useActivationError } from '@/lib/activation-errors';
import { captureBrowser, observeRender } from '@/lib/analytics/browser';
import { localizedAuthPath } from '@/lib/app-locale';
import { newRenderHref } from '@/lib/new-render-href';
import { startRenderPolling } from '@/lib/render-polling';
import { ROUTES } from '@/lib/seo/routes';
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
  sampleDownload,
  initialQuality = 'low',
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
  sampleDownload?: string;
  /** The quality picked in the prompt bar, shown selected on the build button. */
  initialQuality?: BuildQuality;
}) {
  const t = useTranslations('Render');
  const locale = useLocale();
  const localizedError = useActivationError();
  const trialText = useTranslations('FirstModel');
  const format = useFormatter();
  const router = useRouter();
  const [render, setRender] = useState(initial);
  const [hasConnectionError, setHasConnectionError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [quality, setQuality] = useState<BuildQuality>(initialQuality);
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
  // Signed-in people start a new render in the app (the dashboard composer), not on the marketing home.
  const home = ROUTES.home.paths[isLocale(locale) ? locale : 'en'];
  const newHref = signedIn ? newRenderHref(true) : `${home}#try`;
  const isCorrecting = render.status === 'drafting' && render.hasSheet;
  const isPaidSheet = render.status === 'drafting' && !render.hasSheet && render.credits > 0;
  const statusLabel = t(
    isCorrecting
      ? 'status.correcting'
      : isPaidSheet
        ? 'status.paidSheet'
        : `status.${render.status}`,
  );
  // Signing up or buying credits comes back to this page with the chosen quality still selected.
  const next = encodeURIComponent(
    `/r/${render.id}${quality === 'low' ? '' : `?quality=${quality}`}`,
  );
  const signupHref = `${localizedAuthPath(locale, '/sign-up')}?next=${next}`;
  // The first-model offer is created once when the preview is ready. The POST is not repeated on
  // reconnect or on a later mount of the same page.
  const trial = useQuery({
    queryKey: ['trial', initial.id],
    enabled: owner && render.status === 'preview_ready',
    gcTime: 0,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/renders/${render.id}/trial`, { method: 'POST', signal });
      if (!response.ok) throw new Error('Offer unavailable');
      return (await response.json()) as FirstModelOffer | null;
    },
  });
  const trialOffer = trial.isSuccess && !trial.isFetching ? trial.data : undefined;
  const hasTrialError = trial.isError && !trial.isFetching;
  const upscales = useUpscales({ renderId: initial.id }, owner && signedIn && render.canUpscale);

  // use-effect-audit: ignore polls the render through the abortable poller in lib/render-polling, which has its own tests
  useEffect(() => {
    if (!RUNNING.has(render.status)) return;
    return startRenderPolling(
      render.id,
      (updated) => {
        setRender(updated);
        if (!RUNNING.has(updated.status)) router.refresh();
      },
      setHasConnectionError,
    );
  }, [render.id, render.status, router]);

  // use-effect-audit: ignore reports the render state to analytics, an external system
  useEffect(() => {
    if (owner) observeRender(render);
  }, [render, owner]);

  async function build(isUsingFreeModel = false) {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch(`/api/renders/${render.id}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          isUsingFreeModel
            ? { useFreeModel: true, maxCredits: 0 }
            : { maxCredits: owed, ...(quality === 'low' ? {} : { quality }) },
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
      } else {
        setError(
          localizedError(
            data,
            t(data.code === 'upstream' ? 'errors.buildStartRefunded' : 'errors.start'),
          ),
        );
        if (isUsingFreeModel && ['trial_unavailable', 'trial_verify_email'].includes(data.code)) {
          void trial.refetch();
        }
      }
    } catch {
      setError(t('errors.start'));
    } finally {
      setStarting(false);
    }
  }

  // A Medium or High model rebuilt in Standard, free: the credit difference comes back once.
  async function rebuild() {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch(`/api/renders/${render.id}/rebuild`, { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setRender(data);
        router.refresh();
        captureBrowser('render_rebuild_standard', {
          source: 'render_detail',
          credits_returned: render.rebuildRefundCredits,
        });
      } else {
        setError(localizedError(data, t('errors.rebuild')));
      }
    } catch {
      setError(t('errors.rebuild'));
    } finally {
      setStarting(false);
    }
  }

  async function makeSheet() {
    setStarting(true);
    setError(null);
    const response = await fetch(`/api/renders/${render.id}/sheet`, { method: 'POST' }).catch(
      () => null,
    );
    const data = (await response?.json().catch(() => null)) ?? {};
    if (response?.ok) {
      setRender(data);
      router.refresh();
      captureBrowser('render_sheet_generation_started', {
        source: 'render_detail',
        credits: render.sheetCredits,
      });
    } else {
      setError(
        localizedError(
          data,
          t(data.code === 'upstream' ? 'errors.sheetStartRefunded' : 'errors.sheet'),
        ),
      );
      if (data.code === 'upstream') router.refresh();
    }
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
    }).catch(() => null);
    const data = (await response?.json().catch(() => null)) ?? {};
    if (response?.ok) {
      setIsConfirmingCorrection(false);
      setRender(data);
      router.refresh();
      captureBrowser('render_sheet_redraw_started', {
        source: 'render_detail',
        credits: render.sheetCredits,
      });
    } else {
      setRedrawError(
        localizedError(
          data,
          t(data.code === 'upstream' ? 'errors.redrawStartRefunded' : 'errors.redraw'),
        ),
      );
      if (data.code === 'upstream') router.refresh();
    }
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
  const owed = Math.max(0, render.qualityCredits[quality] - render.credits);
  const base = `/api/renders/${render.id}`;
  const title = render.name || render.prompt || t('untitled');

  const viewer =
    render.status === 'ready' ? (
      <ModelView
        src={`${base}/model?v=${render.modelVersion}`}
        name={render.id}
        downloadUrl={owner ? `${base}/model?download=1` : null}
        exportsUrl={owner && signedIn && canExport ? `${base}/exports` : null}
        editableRenderId={owner ? render.id : undefined}
        nextStepsHref={owner ? newHref : undefined}
      />
    ) : owner && RUNNING.has(render.status) ? null : (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-xl border bg-muted/40 p-6 text-center text-muted-foreground sm:aspect-[4/3]">
        {render.status === 'failed' ? (
          <p className="text-sm">
            {render.failureReason === 'repeated_views'
              ? t('repeatedViewsFailure')
              : render.failureReason === 'inconsistent_structure'
                ? t('inconsistentStructureFailure')
                : t(
                    render.failedStep === 'preview'
                      ? 'errors.previewFailed'
                      : render.failedStep === 'model'
                        ? 'errors.modelFailed'
                        : 'errors.generationFailed',
                  )}
            {Boolean(render.refundedCredits) &&
              !render.failureReason &&
              ` ${t('errors.creditsReturned', { credits: render.refundedCredits ?? 0 })}`}
          </p>
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
            <p className="max-w-sm text-sm">
              {t(render.hasSheet ? 'previewReady' : 'noAngleSheet')}
            </p>
          </>
        )}
      </div>
    );

  const isFixable = owner && signedIn && render.status === 'preview_ready' && render.hasSheet;
  const sheet = render.hasPreview ? (
    <AngleSheet src={`${base}/preview?v=${render.modelVersion}`} />
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
      {owner && Boolean(render.refundedCorrectionCredits) && (
        <Alert variant="destructive">
          <AlertDescription>
            {t('correction.refunded', { credits: render.refundedCorrectionCredits ?? 0 })}
          </AlertDescription>
        </Alert>
      )}
      {owner && render.status === 'preview_ready' && render.hasSheet && (
        <details className="text-sm text-muted-foreground">
          <summary className="cursor-pointer">{t('review.title')}</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {(['shape', 'parts', 'openings', 'material'] as const).map((key) => (
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
            <Label htmlFor="sheet-note">{t('correction.note')}</Label>
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

  const buildAction = (
    <>
      <BuildQualityPicker
        id="build-quality"
        value={quality}
        onChange={setQuality}
        credits={render.qualityCredits}
        isDisabled={starting}
      />
      {(!signedIn || balance >= owed) && (
        <p className="text-sm text-muted-foreground">
          {t('journey.buildCost', { credits: format.number(owed) })}
        </p>
      )}
      {!signedIn ? (
        <Button size="lg" className="h-auto min-h-11 w-full whitespace-normal" asChild>
          <SiteLink href={signupHref}>
            <Sparkles />
            {t('signUpToRender')}
          </SiteLink>
        </Button>
      ) : balance < owed ? (
        <>
          <p className="text-sm text-muted-foreground">
            {t('journey.creditBalance', {
              balance: format.number(balance),
              credits: format.number(owed),
            })}
          </p>
          <Button size="lg" className="h-auto min-h-11 w-full whitespace-normal" asChild>
            <Link href={`/credits?next=${next}`}>{t('buyToRender')}</Link>
          </Button>
        </>
      ) : (
        <Button
          size="lg"
          className="h-auto min-h-11 w-full whitespace-normal"
          onClick={() => build()}
          disabled={starting}
        >
          {starting ? <Loader2 className="animate-spin" /> : <Box />}
          {t('render3d', { credits: format.number(owed) })}
        </Button>
      )}
    </>
  );

  const actions = owner ? (
    <>
      {render.status === 'preview_ready' &&
        (hasTrialError ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-muted-foreground">
              {trialText('loadError')}
            </p>
            <Button variant="outline" className="w-full" onClick={() => void trial.refetch()}>
              {trialText('retry')}
            </Button>
            <details className="space-y-3 text-sm">
              <summary className="cursor-pointer">{trialText('continuePaid')}</summary>
              {buildAction}
            </details>
          </div>
        ) : (
          <TrialBuildAction
            offer={trialOffer}
            isBusy={starting}
            next={next}
            onBuild={() => build(true)}
            onRefresh={() => void trial.refetch()}
            fallback={buildAction}
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
      {render.status === 'ready' && render.buildQuality !== 'low' && (
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={rebuild} disabled={starting}>
            {starting ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {t('rebuildStandard', { credits: render.rebuildRefundCredits })}
          </Button>
          <p className="text-xs text-muted-foreground">{t('rebuildStandardHint')}</p>
        </div>
      )}
      {render.status === 'failed' && (
        <Button variant="outline" className="w-full" asChild>
          <SiteLink href={newHref}>{t('tryAnother')}</SiteLink>
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
    <>
      <Button className="w-full" asChild>
        <SiteLink href={newHref}>
          <Sparkles />
          {t('makeYourOwn')}
        </SiteLink>
      </Button>
      {sampleDownload && (
        <Button className="w-full" variant="outline" asChild>
          <a href={sampleDownload} download>
            <Download />
            {t('downloadGlb')}
          </a>
        </Button>
      )}
    </>
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
              isCorrecting={isCorrecting}
              isPaidSheet={isPaidSheet}
              isPhotoOnly={render.status === 'preview_ready' && !render.hasSheet}
              hasConnectionError={hasConnectionError}
            />
          ) : undefined
        }
        title={title}
        prompt={render.prompt}
        badges={[statusLabel]}
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
                {statusLabel}
              </span>
            ),
          },
          ...(render.status === 'ready' ? [{ label: t('meta.formats'), value: 'GLB · USDZ' }] : []),
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
