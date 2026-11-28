'use client';

import {
  MODEL_FEEDBACK_COMMENT_MAX,
  MODEL_FEEDBACK_REASONS,
  type ModelFeedbackReason,
} from '@easyrender/core/model-feedback-input';
import { Star, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { captureModelFeedback } from '@/lib/analytics/browser';

// The responsive shell can remount its page without a server refresh. Remember only completed
// decisions in this browser document as well as the database; never retain the private draft.
const recordedModels = new Set<string>();

// Mounted only for an authenticated owner with a finished model and no recorded decision.
// The parent keys it by render ID; every interaction stays in this model's form.
export function ModelFeedback({ renderId }: { renderId: string }) {
  const t = useTranslations('ModelFeedback');
  const id = useId();
  const [rating, setRating] = useState<number | null>(null);
  const [reasons, setReasons] = useState<ModelFeedbackReason[]>([]);
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isClosed, setIsClosed] = useState(() => recordedModels.has(renderId));
  const [hasError, setHasError] = useState(false);
  const isSending = useRef(false);
  const thanks = useRef<HTMLParagraphElement>(null);
  const isLow = rating !== null && rating <= 3;

  async function send(isDismissal: boolean) {
    if (isSending.current || (!isDismissal && rating === null)) return;
    isSending.current = true;
    setIsSaving(true);
    setHasError(false);
    const selectedReasons = isLow ? reasons : [];
    try {
      const response = await fetch(`/api/renders/${renderId}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          isDismissal ? { dismissed: true } : { rating, reasons: selectedReasons, comment },
        ),
      });
      if (response.status === 409) {
        const body = (await response.json()) as { code?: string };
        if (body.code === 'feedback_exists') {
          recordedModels.add(renderId);
          setIsClosed(true);
          return;
        }
      }
      if (!response.ok) throw new Error('Feedback save failed');
      recordedModels.add(renderId);
      if (isDismissal) setIsClosed(true);
      else {
        setIsSubmitted(true);
        // This region already exists, so focus stays meaningful when the submit button disappears.
        thanks.current?.focus();
        if (rating !== null)
          captureModelFeedback(renderId, {
            rating,
            reasons: selectedReasons,
            comment,
          });
      }
    } catch {
      setHasError(true);
    } finally {
      isSending.current = false;
      setIsSaving(false);
    }
  }

  if (isClosed) return null;
  return (
    <Card className="model-feedback-enter gap-0 py-4" aria-labelledby={`${id}-title`}>
      <CardContent className="space-y-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id={`${id}-title`} className="text-sm font-medium">
            {t('title')}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 motion-reduce:transition-none"
            aria-label={t('close')}
            disabled={isSaving}
            onClick={() => (isSubmitted ? setIsClosed(true) : void send(true))}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <p
          ref={thanks}
          tabIndex={-1}
          aria-live="polite"
          aria-atomic="true"
          className="text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isSubmitted ? t('thanks') : ''}
        </p>
        {!isSubmitted && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(false);
            }}
          >
            <RadioGroup
              aria-labelledby={`${id}-title`}
              value={rating?.toString() ?? ''}
              disabled={isSaving}
              className="flex flex-wrap gap-2"
              onValueChange={(value) => {
                setRating(Number(value));
                setHasError(false);
              }}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <RadioGroupItem
                  key={value}
                  value={String(value)}
                  aria-label={t('stars', { rating: value })}
                  className="size-11 items-center p-0"
                >
                  <Star
                    aria-hidden="true"
                    className={`size-4 ${rating !== null && value <= rating ? 'fill-current' : ''}`}
                  />
                </RadioGroupItem>
              ))}
            </RadioGroup>
            {rating !== null && (
              <>
                {isLow && (
                  <fieldset disabled={isSaving} className="space-y-2">
                    <legend className="text-sm font-medium">{t('whatFailed')}</legend>
                    <div className="flex flex-wrap gap-2">
                      {MODEL_FEEDBACK_REASONS.map((reason) => (
                        <Button
                          key={reason}
                          type="button"
                          size="sm"
                          variant={reasons.includes(reason) ? 'secondary' : 'outline'}
                          className="min-h-11 whitespace-normal motion-reduce:transition-none"
                          aria-pressed={reasons.includes(reason)}
                          onClick={() =>
                            setReasons((current) =>
                              current.includes(reason)
                                ? current.filter((item) => item !== reason)
                                : [...current, reason],
                            )
                          }
                        >
                          {t(`reasons.${reason}`)}
                        </Button>
                      ))}
                    </div>
                  </fieldset>
                )}
                <div className="space-y-2">
                  <Label htmlFor={`${id}-comment`}>{t('comment')}</Label>
                  <Textarea
                    id={`${id}-comment`}
                    value={comment}
                    rows={2}
                    maxLength={MODEL_FEEDBACK_COMMENT_MAX}
                    disabled={isSaving}
                    aria-describedby={`${id}-hint`}
                    className="motion-reduce:transition-none"
                    onChange={(event) => setComment(event.target.value)}
                  />
                  <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                    {t('hint')}
                  </p>
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isSaving}
                  className="min-h-11 motion-reduce:transition-none"
                >
                  {t(isSaving ? 'saving' : 'submit')}
                </Button>
              </>
            )}
            {hasError && (
              <p role="alert" className="text-sm text-destructive">
                {t('error')}
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
