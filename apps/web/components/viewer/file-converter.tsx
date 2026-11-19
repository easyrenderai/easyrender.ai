'use client';

import { ArrowRight, Check, Download, FileBox, Loader2, Upload } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { type DragEvent, type ReactNode, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { captureBrowser } from '@/lib/analytics/browser';
import { cn } from '@/lib/utils';
import type { ConvertStage } from '@/lib/viewer/convert';
import {
  EXPORT_FORMATS,
  type ExportFormat,
  extensionOf,
  pickModelFile,
  VIEWER_ACCEPT,
  VIEWER_FORMATS,
  VIEWER_MAX_BYTES,
  type ViewerFormat,
} from '@/lib/viewer/formats';
import { handOffFiles } from '@/lib/viewer/handoff';

type Picked = { files: File[]; main: File; format: ViewerFormat };

type Failure =
  | { kind: 'unsupported'; extension: string }
  | { kind: 'incomplete'; files: string[] }
  | { kind: 'tooLarge' | 'failed' };

type Job =
  | { status: 'idle' }
  | { status: 'working'; stage: ConvertStage; to: ExportFormat }
  | { status: 'done'; to: ExportFormat; url: string; filename: string; bytes: number }
  | { status: 'error'; failure: Failure };

// The first output offered: GLB, the format most tools ask for, or OBJ when the file already is one.
const defaultTarget = (from: ViewerFormat): ExportFormat => (from === 'glb' ? 'obj' : 'glb');

function Step({ state, children }: { state: 'done' | 'active' | 'waiting'; children: ReactNode }) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 text-sm',
        state === 'waiting' && 'text-muted-foreground',
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border">
        {state === 'done' && <Check className="size-3" aria-hidden />}
        {state === 'active' && (
          <Loader2 className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
        )}
      </span>
      {children}
    </li>
  );
}

// The converter: choose a file, choose a format, download. No preview and nothing to learn, for
// someone who needs the other format now. The conversion runs in the browser, so the steps shown
// are the real ones (reading, converting) and there is no upload to wait for. three.js and the
// loaders are downloaded only when a conversion starts.
export function FileConverter({ intro, viewerHref }: { intro: ReactNode; viewerHref: string }) {
  const t = useTranslations('Converter.app');
  const locale = useLocale();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [target, setTarget] = useState<ExportFormat>('glb');
  const [job, setJob] = useState<Job>({ status: 'idle' });
  const [isDragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  // A newer file or format makes an older conversion's result irrelevant.
  const run = useRef(0);

  function reset(next: Job = { status: 'idle' }) {
    run.current += 1;
    if (job.status === 'done') URL.revokeObjectURL(job.url);
    setJob(next);
  }

  function choose(files: File[]) {
    if (files.length === 0) return;
    const model = pickModelFile(files);
    if (!model) {
      setPicked(null);
      reset({
        status: 'error',
        failure: { kind: 'unsupported', extension: extensionOf(files[0].name) },
      });
      return;
    }
    if (model.file.size > VIEWER_MAX_BYTES) {
      setPicked(null);
      reset({ status: 'error', failure: { kind: 'tooLarge' } });
      return;
    }
    setPicked({ files, main: model.file, format: model.format });
    setTarget(defaultTarget(model.format));
    reset();
  }

  async function convert() {
    if (!picked || job.status === 'working') return;
    reset({ status: 'working', stage: 'reading', to: target });
    const id = run.current;
    const to = target;
    const name = picked.main.name.replace(/\.[^.]+$/, '') || 'model';
    try {
      const { convertFile } = await import('@/lib/viewer/convert');
      const { blob, extension } = await convertFile(
        picked.files,
        picked.main,
        picked.format,
        to,
        name,
        (stage) => {
          if (id === run.current) setJob({ status: 'working', stage, to });
        },
      );
      if (id !== run.current) return;
      const url = URL.createObjectURL(blob);
      const filename = `${name}.${extension}`;
      setJob({ status: 'done', to, url, filename, bytes: blob.size });
      // The download starts by itself; the button stays for a browser that blocks it.
      Object.assign(document.createElement('a'), { href: url, download: filename }).click();
      captureBrowser('converter_file_converted', {
        from: picked.format,
        to,
        megabytes: Math.round(picked.main.size / 1_048_576),
      });
    } catch (error) {
      if (id !== run.current) return;
      const files = (error as { files?: unknown }).files;
      const isIncomplete =
        error instanceof Error && error.name === 'MissingFilesError' && Array.isArray(files);
      setJob({
        status: 'error',
        failure: isIncomplete
          ? { kind: 'incomplete', files: (files as unknown[]).map(String) }
          : { kind: 'failed' },
      });
      captureBrowser('converter_file_failed', { from: picked.format, to });
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    choose(Array.from(event.dataTransfer.files));
  }

  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const size = (bytes: number) =>
    bytes < 1_048_576
      ? t('kilobytes', { size: decimal.format(Math.max(bytes / 1024, 0.1)) })
      : t('megabytes', { size: decimal.format(bytes / 1_048_576) });
  const isWorking = job.status === 'working';
  const targets = EXPORT_FORMATS.filter((format) => format !== picked?.format);

  return (
    <section
      aria-label={t('label')}
      className="relative flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center border-b bg-gradient-to-b from-background to-muted px-4 py-12 sm:px-6"
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className="flex w-full max-w-xl flex-col items-center gap-8 text-center">
        {intro}

        <div className="w-full space-y-5 rounded-xl border bg-card p-5 text-left sm:p-6">
          {picked ? (
            <div className="flex items-center gap-3">
              <FileBox className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">{picked.main.name}</p>
                <p className="text-xs text-muted-foreground">{size(picked.main.size)}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isWorking}
                onClick={() => input.current?.click()}
              >
                {t('change')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center">
              <p className="font-medium">{t('dropTitle')}</p>
              <Button type="button" size="lg" onClick={() => input.current?.click()}>
                <Upload />
                {t('browse')}
              </Button>
              <p className="font-mono text-xs text-muted-foreground">
                {VIEWER_FORMATS.map((format) => format.toUpperCase()).join(' · ')}
              </p>
            </div>
          )}

          {picked && job.status !== 'done' && (
            <>
              <fieldset disabled={isWorking} className="space-y-2">
                <legend className="text-sm font-medium">{t('targetLabel')}</legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {targets.map((format) => (
                    <Button
                      key={format}
                      type="button"
                      variant={format === target ? 'default' : 'outline'}
                      aria-pressed={format === target}
                      className="font-mono"
                      onClick={() => {
                        setTarget(format);
                        if (job.status === 'error') reset();
                      }}
                    >
                      {format.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </fieldset>

              {isWorking ? (
                <ol role="status" className="space-y-2">
                  <Step state={job.stage === 'reading' ? 'active' : 'done'}>
                    {t('steps.reading')}
                  </Step>
                  <Step state={job.stage === 'converting' ? 'active' : 'waiting'}>
                    {t('steps.converting', { format: job.to.toUpperCase() })}
                  </Step>
                </ol>
              ) : (
                <Button type="button" size="lg" className="w-full" onClick={() => void convert()}>
                  {t('convert', { format: target.toUpperCase() })}
                  <ArrowRight />
                </Button>
              )}
            </>
          )}

          {job.status === 'done' && (
            <div className="space-y-4">
              <p role="status" className="flex items-center gap-2 text-sm font-medium">
                <Check className="size-4" aria-hidden />
                {t('done', { format: job.to.toUpperCase() })}
              </p>
              <Button size="lg" className="w-full" asChild>
                <a href={job.url} download={job.filename}>
                  <Download />
                  <span className="truncate">{t('download', { name: job.filename })}</span>
                  <span className="font-mono text-xs opacity-70">{size(job.bytes)}</span>
                </a>
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="button" variant="outline" className="flex-1" onClick={() => reset()}>
                  {t('otherFormat')}
                </Button>
                <Button variant="outline" className="flex-1" asChild>
                  <Link
                    href={viewerHref}
                    onClick={() => {
                      if (picked) handOffFiles(picked.files);
                    }}
                  >
                    {t('view')}
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {job.status === 'error' && (
            <p role="alert" className="text-sm text-destructive">
              {job.failure.kind === 'unsupported'
                ? t('errors.unsupported', { extension: job.failure.extension || '?' })
                : job.failure.kind === 'incomplete'
                  ? t('errors.incomplete', { files: job.failure.files.join(', ') })
                  : job.failure.kind === 'tooLarge'
                    ? t('errors.tooLarge', { megabytes: VIEWER_MAX_BYTES / 1_048_576 })
                    : t('errors.failed')}
            </p>
          )}
        </div>

        <p className="max-w-sm text-xs text-muted-foreground">{t('privacy')}</p>
      </div>

      <Input
        ref={input}
        type="file"
        multiple
        accept={VIEWER_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Reset so picking the same file again still fires a change.
          event.target.value = '';
          choose(files);
        }}
      />

      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/85 p-3 sm:p-6">
          <div className="flex size-full items-center justify-center rounded-xl border border-dashed border-primary text-2xl font-medium">
            {t('dropActive')}
          </div>
        </div>
      )}
    </section>
  );
}
