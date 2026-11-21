'use client';

import { ImagePlus, Loader2, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActivationError } from '@/lib/activation-errors';
import { attribution, attributionHeaders, observeRender } from '@/lib/analytics/browser';
import { prepare } from '@/lib/prepare-image';
import { cn } from '@/lib/utils';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// The app's home: one button. Choosing, dropping or pasting a photo starts the free preview at
// once. Dragging a file anywhere over the page lights the box up.
export function HomeComposer() {
  const t = useTranslations('AppHome');
  const localizedError = useActivationError();
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const isStarting = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // One job: a photo starts the free preview at once. Nothing else to fill in; the quality and the
  // cost are chosen on the render's page, where the sheet can be checked first.
  const start = useCallback(
    async (file: File | null | undefined) => {
      if (!file || isStarting.current) return;
      if (!TYPES.includes(file.type)) {
        setError(t('errors.type'));
        return;
      }
      isStarting.current = true;
      setIsBusy(true);
      setError(null);
      let isLeaving = false;
      try {
        const body = new FormData();
        body.append('attribution', JSON.stringify(attribution()));
        const photo = await prepare(file).catch(() => null);
        if (!photo) {
          setError(t('errors.unreadable'));
        } else {
          body.append('image', photo, 'source.jpg');
          const response = await fetch('/api/renders', {
            method: 'POST',
            body,
            headers: attributionHeaders(),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || typeof data.id !== 'string') {
            setError(localizedError(data, t('errors.upload')));
          } else {
            observeRender(data);
            isLeaving = true;
            router.push(`/r/${data.id}`);
          }
        }
      } catch {
        setError(t('errors.upload'));
      }
      if (picker.current) picker.current.value = '';
      if (isLeaving) return;
      isStarting.current = false;
      setIsBusy(false);
    },
    [localizedError, router, t],
  );

  // Page-wide drag and paste. A depth counter, because dragenter and dragleave fire for every
  // child the pointer crosses.
  // use-effect-audit: ignore subscribes to window drag, drop and paste events
  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') === true;
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth += 1;
      setIsDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsDragging(false);
    };
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setIsDragging(false);
      void start(event.dataTransfer?.files[0]);
    };
    const paste = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith('image/'),
      );
      if (image) void start(image);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, [start]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-8">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-balance">
        {t('heading')}
      </h1>
      <div
        className={cn(
          'relative w-full max-w-xl space-y-3 rounded-2xl border bg-card p-4 shadow-xs transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none',
          isDragging && 'border-foreground ring-4 ring-foreground/10',
        )}
        aria-busy={isBusy}
      >
        <Input
          ref={picker}
          type="file"
          accept={TYPES.join(',')}
          className="hidden"
          tabIndex={-1}
          aria-label={t('upload')}
          onChange={(event) => void start(event.target.files?.[0])}
        />
        <Button
          type="button"
          size="lg"
          className="h-12 w-full text-base"
          disabled={isBusy}
          onClick={() => picker.current?.click()}
        >
          {isBusy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {isBusy ? t('uploading') : t('upload')}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{t('hint')}</p>
        <p className="text-center text-xs text-muted-foreground">{t('costNote')}</p>
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 grid place-content-center justify-items-center gap-1.5 rounded-2xl border-2 border-dashed border-foreground bg-background/95 opacity-0 transition-opacity duration-200 motion-reduce:transition-none',
            isDragging && 'opacity-100',
          )}
        >
          <ImagePlus className="size-6" />
          <span className="text-sm font-medium">{t('dropOverlay')}</span>
        </div>
      </div>
      {error && (
        <Alert variant="destructive" className="max-w-xl">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
