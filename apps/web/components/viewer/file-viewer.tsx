'use client';

import {
  Axis3d,
  Box,
  Camera,
  Download,
  Grid3x3,
  Loader2,
  Maximize,
  Pause,
  Play,
  Rotate3d,
  ScanEye,
  SunMoon,
  Upload,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type DragEvent, type ReactNode, useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { captureBrowser } from '@/lib/analytics/browser';
import { versionedPublicModel } from '@/lib/public-models';
import { cn } from '@/lib/utils';
import type { ModelInfo, Viewer } from '@/lib/viewer/engine';
import {
  EXPORT_FORMATS,
  type ExportFormat,
  extensionOf,
  pickModelFile,
  VIEWER_ACCEPT,
  VIEWER_FORMATS,
  VIEWER_MAX_BYTES,
} from '@/lib/viewer/formats';
import { takeHandedOffFiles } from '@/lib/viewer/handoff';
import { hasWebGL } from '@/lib/webgl';

const SAMPLE = { name: 'clay-vase.glb', url: '/studio/models/clay-vase.hd.glb' };

type Failure =
  | { kind: 'unsupported'; extension: string }
  | { kind: 'incomplete'; files: string[] }
  | { kind: 'tooLarge' | 'webgl' | 'failed' | 'sample' };

type State =
  | { status: 'empty' }
  | { status: 'loading'; name: string }
  | { status: 'ready'; name: string; bytes: number; info: ModelInfo }
  | { status: 'error'; failure: Failure };

function ToolButton({
  label,
  isPressed,
  onClick,
  children,
}: {
  label: string;
  isPressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant={isPressed ? 'default' : 'ghost'}
      aria-label={label}
      aria-pressed={isPressed}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

// The stage: a full-width drop zone that becomes the canvas. `intro` is the page heading, rendered
// on the server and shown inside the empty stage. three.js and the loaders are only downloaded once a file is
// dropped, so the page itself stays as light as any other marketing page. Files are parsed in
// the browser and never leave it.
export function FileViewer({ intro }: { intro: ReactNode }) {
  const t = useTranslations('Viewer.app');
  const locale = useLocale();
  const [state, setState] = useState<State>({ status: 'empty' });
  const [isDragging, setDragging] = useState(false);
  const [isRotating, setRotating] = useState(false);
  const [isWireframe, setWireframe] = useState(false);
  const [hasGrid, setGrid] = useState(true);
  const [isLight, setLight] = useState(false);
  const [isPlaying, setPlaying] = useState(true);
  const [converting, setConverting] = useState<ExportFormat | null>(null);
  const [hasConvertError, setConvertError] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const viewer = useRef<Viewer | null>(null);
  const dragDepth = useRef(0);

  // The canvas owns the WebGL context: when React removes it, the viewer goes with it.
  const attachCanvas = useCallback((node: HTMLCanvasElement | null) => {
    canvas.current = node;
    // Arriving from the converter with a model already chosen: open it straight away.
    const handedOff = node ? takeHandedOffFiles() : null;
    if (handedOff) void openRef.current(handedOff, 'converter');
    return () => {
      viewer.current?.dispose();
      viewer.current = null;
      canvas.current = null;
    };
  }, []);

  async function open(files: File[], source: 'drop' | 'picker' | 'sample' | 'converter') {
    if (files.length === 0) return;
    const picked = pickModelFile(files);
    if (!picked) {
      const extension = extensionOf(files[0].name);
      setState({ status: 'error', failure: { kind: 'unsupported', extension } });
      return;
    }
    if (picked.file.size > VIEWER_MAX_BYTES) {
      setState({ status: 'error', failure: { kind: 'tooLarge' } });
      return;
    }
    if (!canvas.current || !hasWebGL()) {
      setState({ status: 'error', failure: { kind: 'webgl' } });
      return;
    }
    setConvertError(false);
    setState({ status: 'loading', name: picked.file.name });
    try {
      if (!viewer.current) {
        const { createViewer } = await import('@/lib/viewer/engine');
        if (!canvas.current) return;
        viewer.current ??= createViewer(canvas.current);
        viewer.current.setAutoRotate(isRotating);
        viewer.current.setWireframe(isWireframe);
        viewer.current.setGrid(hasGrid);
      }
      const info = await viewer.current.open(files, picked.file, picked.format);
      // Null: a newer file replaced this one while it was parsing.
      if (!info) return;
      setPlaying(true);
      viewer.current.setPlaying(true);
      setState({ status: 'ready', name: picked.file.name, bytes: picked.file.size, info });
      captureBrowser('viewer_model_opened', {
        format: picked.format,
        source,
        triangles: info.triangles,
        megabytes: Math.round(picked.file.size / 1_048_576),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      const files = (error as { files?: unknown }).files;
      setState({
        status: 'error',
        failure:
          name === 'MissingFilesError' && Array.isArray(files)
            ? { kind: 'incomplete', files: files.map(String) }
            : { kind: name === 'WebGLUnavailableError' ? 'webgl' : 'failed' },
      });
      captureBrowser('viewer_model_failed', { format: picked.format, source });
    }
  }

  // Read through a ref so the canvas callback, created once, calls the current closure.
  const openRef = useRef(open);
  openRef.current = open;

  async function openSample() {
    setState({ status: 'loading', name: SAMPLE.name });
    try {
      const response = await fetch(versionedPublicModel(SAMPLE.url));
      if (!response.ok) throw new Error('sample unavailable');
      await open([new File([await response.blob()], SAMPLE.name)], 'sample');
    } catch {
      setState({ status: 'error', failure: { kind: 'sample' } });
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void open(Array.from(event.dataTransfer.files), 'drop');
  }

  async function convert(format: ExportFormat, source: string) {
    if (!viewer.current || converting) return;
    setConverting(format);
    setConvertError(false);
    try {
      const name = source.replace(/\.[^.]+$/, '') || 'model';
      const { blob, extension } = await viewer.current.convert(format, name);
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), {
        href: url,
        download: `${name}.${extension}`,
      }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      captureBrowser('viewer_model_converted', { from: extensionOf(source), to: format });
    } catch {
      setConvertError(true);
    } finally {
      setConverting(null);
    }
  }

  async function saveScreenshot(name: string) {
    const blob = await viewer.current?.screenshot();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), {
      href: url,
      download: `${name.replace(/\.[^.]+$/, '')}.png`,
    });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const number = new Intl.NumberFormat(locale);
  const length = new Intl.NumberFormat(locale, { maximumSignificantDigits: 3 });
  const isReady = state.status === 'ready';
  const info = isReady ? state.info : null;
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const bytes = isReady ? state.bytes : 0;
  const fileSize =
    bytes < 1_048_576
      ? t('stats.kilobytes', { size: decimal.format(Math.max(bytes / 1024, 0.1)) })
      : t('stats.megabytes', { size: decimal.format(bytes / 1_048_576) });
  // glTF and USD are defined in metres; the other formats carry no unit.
  const hasMetres = info ? ['glb', 'gltf', 'usdz'].includes(info.format) : false;
  const dimensions = info ? info.size.map((value) => length.format(value)).join(' × ') : '';

  const stats = info
    ? [
        [t('stats.format'), info.format.toUpperCase()],
        [t('stats.fileSize'), fileSize],
        [t('stats.triangles'), number.format(info.triangles)],
        [t('stats.vertices'), number.format(info.vertices)],
        [t('stats.meshes'), number.format(info.meshes)],
        [t('stats.materials'), number.format(info.materials)],
        [t('stats.textures'), number.format(info.textures)],
        [t('stats.animations'), number.format(info.animations)],
        [t('stats.dimensions'), hasMetres ? t('stats.metres', { size: dimensions }) : dimensions],
      ]
    : [];

  return (
    <section
      aria-label={t('label')}
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
      <div
        ref={frame}
        aria-busy={state.status === 'loading'}
        className={cn(
          'relative w-full overflow-hidden border-b transition-colors duration-200',
          // The stage fills the first screen. On a phone a loaded model leaves room below it, so
          // the page can still be scrolled past a canvas that takes every touch.
          isReady
            ? 'h-[72svh] min-h-80 sm:h-[calc(100svh-3.5rem)] sm:min-h-[30rem]'
            : 'flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center',
          isLight && isReady ? 'bg-foreground' : 'bg-gradient-to-b from-background to-muted',
        )}
      >
        <canvas
          ref={attachCanvas}
          role="img"
          aria-label={isReady ? t('canvasAlt', { name: state.name }) : undefined}
          aria-hidden={!isReady}
          className={cn(
            'absolute inset-0 size-full touch-none cursor-grab outline-none active:cursor-grabbing',
            !isReady && 'invisible',
          )}
        />

        {/* The empty stage shows the floor the model will stand on: the same grid the viewer
            draws, in perspective, fading into the distance. */}
        {!isReady && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 overflow-hidden [perspective-origin:50%_0%] [perspective:32rem]"
          >
            <div
              className="absolute -inset-x-full bottom-0 h-[300%] origin-bottom [transform:rotateX(78deg)] [mask-image:linear-gradient(to_bottom,transparent_35%,black)]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
                backgroundSize: '4rem 4rem',
              }}
            />
          </div>
        )}

        {/* Kept in the document while a model is on screen: it is the page's heading. */}
        <div
          className={cn(
            'relative flex w-full max-w-3xl flex-col items-center gap-8 px-4 py-12 text-center sm:px-6',
            isReady && 'sr-only',
          )}
        >
          {intro}
          {!isReady && (
            <div className="flex flex-col items-center gap-4">
              {state.status === 'loading' ? (
                <div role="status" className="flex flex-col items-center gap-3 py-6 text-sm">
                  <Loader2
                    className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none"
                    aria-hidden
                  />
                  <span className="text-muted-foreground">
                    {t('loading', { name: state.name })}
                  </span>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="flex items-center justify-center gap-2 text-lg font-medium">
                      <Box className="size-5 text-muted-foreground" aria-hidden />
                      {t('dropTitle')}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {VIEWER_FORMATS.map((format) => format.toUpperCase()).join(' · ')}
                    </p>
                  </div>
                  {state.status === 'error' && (
                    <p role="alert" className="max-w-md text-sm text-destructive">
                      {state.failure.kind === 'unsupported'
                        ? t('errors.unsupported', { extension: state.failure.extension || '?' })
                        : state.failure.kind === 'incomplete'
                          ? t('errors.incomplete', { files: state.failure.files.join(', ') })
                          : state.failure.kind === 'tooLarge'
                            ? t('errors.tooLarge', { megabytes: VIEWER_MAX_BYTES / 1_048_576 })
                            : t(`errors.${state.failure.kind}`)}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button type="button" size="lg" onClick={() => input.current?.click()}>
                      <Upload />
                      {t('browse')}
                    </Button>
                    <Button type="button" size="lg" variant="outline" onClick={openSample}>
                      {t('sample')}
                    </Button>
                  </div>
                  <p className="max-w-sm text-xs text-muted-foreground">{t('privacy')}</p>
                </>
              )}
            </div>
          )}
        </div>

        {isReady && (
          <>
            <div className="absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2 sm:inset-x-6 sm:top-4">
              <div className="flex min-w-0 items-center gap-2">
                <p className="min-w-0 truncate rounded-md border bg-popover px-2.5 py-1.5 font-mono text-xs text-popover-foreground">
                  {state.name}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="border"
                  onClick={() => input.current?.click()}
                >
                  <Upload />
                  {t('openAnother')}
                </Button>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <fieldset
                  disabled={converting !== null}
                  className="flex flex-wrap items-center gap-1 rounded-lg border bg-popover p-1 text-popover-foreground"
                >
                  <legend className="sr-only">{t('convert.label')}</legend>
                  <span aria-hidden className="flex items-center gap-1.5 px-2 text-xs font-medium">
                    <Download className="size-3.5" />
                    {t('convert.label')}
                  </span>
                  {EXPORT_FORMATS.filter((format) => format !== state.info.format).map((format) => (
                    <Button
                      key={format}
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="font-mono text-xs"
                      aria-busy={converting === format}
                      aria-label={t('convert.to', { format: format.toUpperCase() })}
                      onClick={() => void convert(format, state.name)}
                    >
                      {converting === format && (
                        <Loader2 className="animate-spin motion-reduce:animate-none" />
                      )}
                      {format.toUpperCase()}
                    </Button>
                  ))}
                </fieldset>
                {hasConvertError && (
                  <p
                    role="alert"
                    className="max-w-xs rounded-md border bg-popover px-2.5 py-1.5 text-xs text-destructive"
                  >
                    {t('convert.error')}
                  </p>
                )}
              </div>
            </div>
            <div className="absolute inset-x-3 bottom-3 flex flex-col items-center gap-2 sm:bottom-5">
              <div
                role="toolbar"
                aria-label={t('toolbar.label')}
                className="flex w-fit flex-wrap items-center justify-center gap-1 rounded-lg border bg-popover p-1 text-popover-foreground"
              >
                <ToolButton label={t('toolbar.reset')} onClick={() => viewer.current?.resetView()}>
                  <ScanEye />
                </ToolButton>
                <ToolButton
                  label={t('toolbar.rotate')}
                  isPressed={isRotating}
                  onClick={() => {
                    viewer.current?.setAutoRotate(!isRotating);
                    setRotating(!isRotating);
                  }}
                >
                  <Rotate3d />
                </ToolButton>
                <ToolButton
                  label={t('toolbar.wireframe')}
                  isPressed={isWireframe}
                  onClick={() => {
                    viewer.current?.setWireframe(!isWireframe);
                    setWireframe(!isWireframe);
                  }}
                >
                  <Box />
                </ToolButton>
                <ToolButton
                  label={t('toolbar.grid')}
                  isPressed={hasGrid}
                  onClick={() => {
                    viewer.current?.setGrid(!hasGrid);
                    setGrid(!hasGrid);
                  }}
                >
                  <Grid3x3 />
                </ToolButton>
                <ToolButton
                  label={t('toolbar.background')}
                  isPressed={isLight}
                  onClick={() => setLight(!isLight)}
                >
                  <SunMoon />
                </ToolButton>
                <ToolButton
                  label={t('toolbar.flip')}
                  onClick={() => {
                    const size = viewer.current?.flipUpAxis();
                    if (size) setState({ ...state, info: { ...state.info, size } });
                  }}
                >
                  <Axis3d />
                </ToolButton>
                {state.info.animations > 0 && (
                  <ToolButton
                    label={t(isPlaying ? 'toolbar.pause' : 'toolbar.play')}
                    onClick={() => {
                      viewer.current?.setPlaying(!isPlaying);
                      setPlaying(!isPlaying);
                    }}
                  >
                    {isPlaying ? <Pause /> : <Play />}
                  </ToolButton>
                )}
                <ToolButton
                  label={t('toolbar.screenshot')}
                  onClick={() => void saveScreenshot(state.name)}
                >
                  <Camera />
                </ToolButton>
                <ToolButton
                  label={t('toolbar.fullscreen')}
                  onClick={() => {
                    if (document.fullscreenElement) void document.exitFullscreen();
                    else void frame.current?.requestFullscreen?.();
                  }}
                >
                  <Maximize />
                </ToolButton>
              </div>
              <p
                className={cn(
                  'hidden text-xs sm:block',
                  isLight ? 'text-background/70' : 'text-muted-foreground',
                )}
              >
                {t('controls')}
              </p>
            </div>
          </>
        )}

        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/85 p-3 sm:p-6">
            <div className="flex size-full items-center justify-center rounded-xl border border-dashed border-primary text-2xl font-medium">
              {t('dropActive')}
            </div>
          </div>
        )}
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
          void open(files, 'picker');
        }}
      />

      {isReady && (
        <div className="mx-auto max-w-5xl space-y-4 px-4 pt-6 sm:px-6">
          {state.info.missing.length > 0 && (
            <p role="status" className="text-sm text-muted-foreground">
              {t('missing', { files: state.info.missing.join(', ') })}
            </p>
          )}
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
            {stats.map(([label, value]) => (
              <div key={label} className="space-y-1 bg-card p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-mono text-sm tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-center text-xs text-muted-foreground sm:hidden">{t('controls')}</p>
        </div>
      )}
    </section>
  );
}
