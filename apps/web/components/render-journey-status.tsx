import type { RenderView } from '@easyrender/core';
import { Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/** Stage markers describe server state only: no timer, fabricated percentage or inferred completion. */
export function RenderJourneyStatus({
  status,
  hasPreview,
  isCorrecting = false,
  isPaidSheet = false,
  isPhotoOnly = false,
  hasConnectionError = false,
}: {
  status: RenderView['status'];
  hasPreview: boolean;
  isCorrecting?: boolean;
  isPaidSheet?: boolean;
  isPhotoOnly?: boolean;
  hasConnectionError?: boolean;
}) {
  const t = useTranslations('Render.journey');
  const isRunning = status === 'drafting' || status === 'rendering';
  const stage =
    status === 'drafting' && isCorrecting
      ? 'correcting'
      : status === 'drafting' && isPaidSheet
        ? 'paidSheet'
        : status === 'preview_ready' && isPhotoOnly
          ? 'photoOnly'
          : status;
  const current = status === 'ready' || status === 'rendering' ? 2 : 1;
  return (
    <section className="space-y-3" aria-label={t(`${stage}Title`)}>
      <ol className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {(['photo', 'angles', 'model'] as const).map((key, index) => {
          const isDone =
            index === 0 ||
            (index === 1 && hasPreview && status !== 'drafting') ||
            (index === 2 && status === 'ready');
          return (
            <li
              key={key}
              aria-current={index === current && status !== 'failed' ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2',
                !isDone && index !== current && 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'grid size-4 shrink-0 place-items-center rounded-full border font-mono text-xs leading-none',
                  isDone ? 'border-foreground bg-foreground text-background' : 'border-border',
                  !isDone && index === current && 'border-foreground',
                )}
                aria-hidden
              >
                {isDone ? <Check className="size-3" /> : index + 1}
              </span>
              {t(key)}
            </li>
          );
        })}
      </ol>
      {/* A finished model needs no banner: the step row says it, and the viewer is the news. */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'flex items-start gap-3 rounded-xl bg-muted/40 p-4',
          status === 'ready' && !hasConnectionError && 'sr-only',
        )}
      >
        {isRunning && (
          <Loader2
            className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        )}
        <div>
          <h2 className="text-base font-medium">{t(`${stage}Title`)}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`${stage}Body`)}</p>
          {hasConnectionError && (
            <p className="mt-2 text-sm text-muted-foreground">{t('connection')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
