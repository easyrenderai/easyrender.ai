'use client';

import { ImagePlus, Loader2, Sparkles, TriangleAlert, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { SiteLink as Link } from '@/components/site-link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useActivationError } from '@/lib/activation-errors';
import {
  attribution,
  attributionHeaders,
  captureBrowser,
  observeRender,
} from '@/lib/analytics/browser';
import { TRY_ONE_EXAMPLES } from '@/lib/marketing-examples';
import { prepare } from '@/lib/prepare-image';
import { cn } from '@/lib/utils';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export { prepare };

export function PromptBar({ signedIn, compact = false }: { signedIn: boolean; compact?: boolean }) {
  const t = useTranslations('PromptBar');
  const localizedError = useActivationError();
  const showcase = useTranslations('Showcase');
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const isSubmitting = useRef(false);
  const requestKey = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isDragging, setDragging] = useState(false);
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // use-effect-audit: ignore releases the blob URL of the thumbnail when it is replaced or the page unmounts
  useEffect(() => () => void (thumb && URL.revokeObjectURL(thumb)), [thumb]);

  const pick = useCallback(
    (next: File | null | undefined) => {
      if (!next || isSubmitting.current) return;
      if (!TYPES.includes(next.type)) {
        setError(t('errors.type'));
        return;
      }
      setError(null);
      requestKey.current = null;
      setFile(next);
      captureBrowser('photo_selected', { source: 'home' });
      setThumb(URL.createObjectURL(next));
    },
    [t],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting.current) return;
    if (!file) {
      input.current?.click();
      return;
    }
    isSubmitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('attribution', JSON.stringify(attribution()));
      const photo = await prepare(file).catch(() => null);
      if (!photo) {
        setError(t('errors.unreadable'));
        return;
      }
      body.append('image', photo, 'source.jpg');
      body.append('prompt', prompt);
      body.append('isPublic', 'false');
      requestKey.current ??= crypto.randomUUID();
      const response = await fetch('/api/renders', {
        method: 'POST',
        body,
        headers: { ...attributionHeaders(), 'idempotency-key': requestKey.current },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.id !== 'string') {
        setError(localizedError(data, t('errors.upload')));
        return;
      }
      observeRender(data);
      captureBrowser('render_preview_created', { source: 'home', has_prompt: Boolean(prompt) });
      // Anonymous visitors can inspect their real, watermarked sheet here. Registration is
      // requested only when they choose to build; the server enforces ownership and quotas.
      router.push(`/r/${data.id}`);
    } catch {
      setError(t('errors.upload'));
    } finally {
      isSubmitting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-3">
      <form
        onSubmit={submit}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pick(event.dataTransfer.files[0]);
        }}
        onPaste={(event) => {
          const pasted = Array.from(event.clipboardData.files).find((item) =>
            item.type.startsWith('image/'),
          );
          if (pasted) {
            event.preventDefault();
            pick(pasted);
          }
        }}
        className={cn(
          'relative space-y-3 text-left',
          (!compact || file) && 'rounded-xl border bg-card p-4',
          isDragging && 'border-dashed border-primary',
        )}
        aria-busy={isBusy}
      >
        <Input
          ref={input}
          type="file"
          accept={TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-label={t('attachPhoto')}
          disabled={isBusy}
          onChange={(event) => pick(event.target.files?.[0])}
        />
        {file && thumb ? (
          <div className="flex items-center gap-3">
            {/* biome-ignore lint/performance/noImgElement: local object URL */}
            <img src={thumb} alt={file.name} className="size-16 rounded-md object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{file.name}</p>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="px-0"
                disabled={isBusy}
                onClick={() => input.current?.click()}
              >
                {t('replacePhoto')}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isBusy}
              aria-label={t('removePhoto')}
              onClick={() => {
                setFile(null);
                setThumb(null);
                setError(null);
                requestKey.current = null;
                if (input.current) input.current.value = '';
              }}
            >
              <X />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant={compact ? 'default' : 'outline'}
            size="lg"
            className={
              compact ? 'h-12 w-full sm:w-auto' : 'h-auto w-full flex-col gap-2 border-dashed py-5'
            }
            disabled={isBusy}
            onClick={() => input.current?.click()}
          >
            <ImagePlus className="size-6" />
            <span>{t(compact ? 'startPreview' : 'attachPhoto')}</span>
            {!compact && (
              <span className="text-xs font-normal text-muted-foreground">{t('dropOrPaste')}</span>
            )}
          </Button>
        )}
        {(!compact || file) && (
          <>
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">
                {t('optionalNotes')}
              </summary>
              <Label htmlFor="photo-notes" className="sr-only">
                {t('optionalNotes')}
              </Label>
              <Textarea
                id="photo-notes"
                value={prompt}
                rows={2}
                maxLength={500}
                disabled={isBusy}
                placeholder={t('placeholder.withPhoto')}
                className="mt-2 resize-none"
                onChange={(event) => {
                  setPrompt(event.target.value);
                  requestKey.current = null;
                }}
              />
            </details>
            <Button type="submit" disabled={isBusy} className="w-full">
              {isBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {isBusy ? t('uploadingReal') : t('generate')}
            </Button>
          </>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t(compact ? 'compactNote' : signedIn ? 'previewNote' : 'guestNote')}
        </p>
        {isBusy && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('uploadingHint')}
          </p>
        )}
      </form>
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>{t('errors.title')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!compact && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('seeExample')}</span>
          {TRY_ONE_EXAMPLES.map((example) => (
            <Button key={example.id} variant="outline" size="sm" asChild>
              <Link href={`/r/${example.id}`}>
                <Image
                  src={example.photo}
                  alt=""
                  width={20}
                  height={20}
                  sizes="20px"
                  className="size-5 rounded-full object-cover"
                />
                {showcase(`items.${example.slug}.title`)}
              </Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
