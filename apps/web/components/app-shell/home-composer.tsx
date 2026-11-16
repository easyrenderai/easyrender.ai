'use client';

import { FolderOpen, ImagePlus, Loader2, TriangleAlert, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { attribution, attributionHeaders, observeRender } from '@/lib/analytics/browser';
import { prepare } from '@/lib/prepare-image';
import { cn } from '@/lib/utils';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// The app's home: a prompt bar built around a drop slot. A photo is all it needs; the text is
// optional. Dragging a file anywhere over the page lights the bar up.
export function HomeComposer() {
  const t = useTranslations('AppHome');
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void (thumb && URL.revokeObjectURL(thumb)), [thumb]);

  const pick = useCallback(
    (next: File | null | undefined) => {
      if (!next) return;
      if (!TYPES.includes(next.type)) {
        setError(t('errors.type'));
        return;
      }
      setError(null);
      setFile(next);
      setThumb(URL.createObjectURL(next));
    },
    [t],
  );

  const clear = () => {
    setFile(null);
    setThumb(null);
    setError(null);
    if (picker.current) picker.current.value = '';
  };

  // Page-wide drag and paste. A depth counter, because dragenter and dragleave fire for every
  // child the pointer crosses.
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
      pick(event.dataTransfer?.files[0]);
    };
    const paste = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith('image/'),
      );
      if (image) pick(image);
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
  }, [pick]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('attribution', JSON.stringify(attribution()));
      body.append('image', await prepare(file, t('errors.unreadable')), 'source.jpg');
      body.append('prompt', prompt);
      const response = await fetch('/api/renders', {
        method: 'POST',
        body,
        headers: attributionHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? t('errors.upload'));
      observeRender(data);
      router.push(`/r/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.upload'));
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-8">
      <h1 className="text-center text-3xl font-semibold tracking-tight text-balance">
        {t('heading')}
      </h1>
      <form
        onSubmit={submit}
        className={cn(
          'relative w-full max-w-2xl rounded-2xl border bg-card p-3.5 shadow-xs transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30 motion-reduce:transition-none',
          isDragging && 'border-foreground ring-4 ring-foreground/10',
        )}
      >
        <div className="flex gap-3.5">
          {file && thumb ? (
            <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border">
              {/* biome-ignore lint/performance/noImgElement: local object URL thumbnail */}
              <img src={thumb} alt={file.name} className="size-full object-cover" />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="absolute top-1 right-1 size-6 rounded-full"
                onClick={clear}
                aria-label={t('remove')}
              >
                <X className="size-3" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => picker.current?.click()}
              className="size-24 shrink-0 flex-col gap-1 rounded-xl border-dashed border-foreground bg-muted font-medium hover:bg-accent"
            >
              <ImagePlus className="size-5" />
              <span className="text-xs">{t('slot')}</span>
            </Button>
          )}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
            <Input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={500}
              placeholder={t('placeholder')}
              aria-label={t('placeholder')}
              className="h-auto border-0 bg-transparent px-1 py-1 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <p className="truncate px-1 text-xs text-muted-foreground">
              {file ? file.name : t('hint')}
            </p>
          </div>
          <Input
            ref={picker}
            type="file"
            accept={TYPES.join(',')}
            className="hidden"
            onChange={(event) => pick(event.target.files?.[0])}
          />
        </div>
        <div className="mt-3 flex items-center justify-end gap-3">
          <Button type="submit" disabled={!file || isBusy}>
            {isBusy && <Loader2 className="animate-spin" />}
            {isBusy ? t('uploading') : t('create')}
          </Button>
        </div>
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
      </form>
      {error && (
        <Alert variant="destructive" className="max-w-2xl">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap justify-center gap-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/library">
            <FolderOpen />
            {t('batch')}
          </Link>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/connectors">{t('connect')}</Link>
        </Button>
      </div>
    </div>
  );
}
