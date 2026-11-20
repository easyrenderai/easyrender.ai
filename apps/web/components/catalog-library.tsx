'use client';

import type { LibraryFolderView, LibraryItemView, RenderView } from '@easyrender/core';
import {
  AlertCircle,
  Box,
  FolderInput,
  Grid3x3,
  ImageUp,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShellPanel } from '@/components/app-shell/shell-context';
import {
  DeleteFolderDialog,
  FolderNameDialog,
  MoveDialog,
} from '@/components/library-folder-dialogs';
import { type FolderScope, LibraryPanel } from '@/components/library-panel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useActivationError } from '@/lib/activation-errors';
import {
  attribution,
  attributionHeaders,
  captureBrowser,
  observeRender,
} from '@/lib/analytics/browser';
import { prepare } from '@/lib/prepare-image';
import { cn } from '@/lib/utils';

const UPLOAD_CONCURRENCY = 2;
const BUILD_CONCURRENCY = 3;
const POLL_MS = 4000;

type QueuedUpload = {
  key: string;
  name: string;
  url: string;
  file: File;
  prompt?: string;
  error: string | null;
};
type View = 'photo' | '3d' | 'compare';
type Filter = 'all' | 'needs' | 'working' | 'done' | 'failed';

const FILTERS: { id: Filter; match: (item: RenderView) => boolean }[] = [
  { id: 'all', match: () => true },
  { id: 'needs', match: (item) => item.status === 'preview_ready' },
  {
    id: 'working',
    match: (item) => item.status === 'drafting' || item.status === 'rendering',
  },
  { id: 'done', match: (item) => item.status === 'ready' },
  { id: 'failed', match: (item) => item.status === 'failed' },
];

const VIEWS: View[] = ['photo', '3d', 'compare'];

const baseName = (file: File) => file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');

// Runs `task` over `items` with at most `limit` in flight. Stops starting new ones once
// `task` returns false (out of credits, daily limit reached).
async function pool<T>(items: T[], limit: number, task: (item: T) => Promise<boolean>) {
  let next = 0;
  let stopped = false;
  const worker = async () => {
    while (!stopped && next < items.length) {
      const item = items[next++];
      if (!(await task(item))) stopped = true;
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return items.slice(next);
}

export function CatalogLibrary({
  initial,
  initialFolders,
  initialBalance,
  renderCredits,
  sheetCredits,
}: {
  initial: LibraryItemView[];
  initialFolders: LibraryFolderView[];
  initialBalance: number;
  renderCredits: number;
  sheetCredits: number;
}) {
  const t = useTranslations('Library');
  const localizedError = useActivationError();
  const format = useFormatter();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [folders, setFolders] = useState(initialFolders);
  const [scope, setScope] = useState<FolderScope>('all');
  const [nameDialog, setNameDialog] = useState<{
    mode: 'create' | 'rename';
    folder?: LibraryFolderView;
  } | null>(null);
  const [deleting, setDeleting] = useState<LibraryFolderView | null>(null);
  const [moving, setMoving] = useState<LibraryItemView | null>(null);
  const [balance, setBalance] = useState(initialBalance);
  const [uploads, setUploads] = useState<QueuedUpload[]>([]);
  const [view, setView] = useState<View>('compare');
  const [filter, setFilter] = useState<Filter>('all');
  const [building, setBuilding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const [viewerReady, setViewerReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // use-effect-audit: ignore reports the renders in view to analytics, an external system
  useEffect(() => {
    items.forEach(observeRender);
  }, [items]);

  // use-effect-audit: ignore registers the model-viewer web component, a widget outside React
  useEffect(() => {
    const controller = new AbortController();
    import('@google/model-viewer').then(() => {
      if (!controller.signal.aborted) setViewerReady(true);
    });
    return () => controller.abort();
  }, []);

  // One poll at a time. A poll that started before a local change (an upload or a build
  // response) is dropped, so it cannot roll the grid or the balance back.
  const polling = useRef<Promise<void> | null>(null);
  const localVersion = useRef(0);
  const refresh = useCallback(async (force = false) => {
    if (polling.current) {
      if (!force) return;
      await polling.current;
    }
    const startedAt = localVersion.current;
    const run = (async () => {
      try {
        const response = await fetch('/api/renders', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as {
          renders: LibraryItemView[];
          balance: number;
          folders: LibraryFolderView[];
        };
        if (localVersion.current !== startedAt) return;
        data.renders.forEach(observeRender);
        setItems(data.renders);
        setFolders(data.folders);
        setBalance(data.balance);
      } catch {
        // The next poll retries.
      }
    })();
    polling.current = run;
    await run;
    polling.current = null;
  }, []);

  const inFlight = items.some((item) => item.status === 'drafting' || item.status === 'rendering');
  // use-effect-audit: ignore polls the list while a render is in flight; the refresh keeps a local-version guard against stale responses
  useEffect(() => {
    if (!inFlight && !building) return;
    const timer = setInterval(() => refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [inFlight, building, refresh]);

  const upsert = (next: RenderView) => {
    observeRender(next);
    localVersion.current += 1;
    // A response describes the render, not where it is filed: keep the folder it already has.
    setItems((current) => {
      const index = current.findIndex((item) => item.id === next.id);
      if (index === -1) return [{ ...next, folderId: null }, ...current];
      return current.map((item) =>
        item.id === next.id ? { ...next, folderId: item.folderId } : item,
      );
    });
  };

  const markFailed = (key: string, error: string) =>
    setUploads((current) => current.map((item) => (item.key === key ? { ...item, error } : item)));

  const dismiss = (key: string) =>
    setUploads((current) => {
      const upload = current.find((item) => item.key === key);
      if (upload) URL.revokeObjectURL(upload.url);
      return current.filter((item) => item.key !== key);
    });

  // Returns false when uploading should stop for now (daily preview limit reached).
  async function uploadOne(upload: QueuedUpload) {
    try {
      const body = new FormData();
      body.append('attribution', JSON.stringify(attribution()));
      const photo = await prepare(upload.file).catch(() => null);
      if (!photo) {
        markFailed(upload.key, t('errors.unreadable'));
        return true;
      }
      body.append('image', photo, 'source.jpg');
      body.append('name', upload.name);
      if (upload.prompt) body.append('prompt', upload.prompt);
      const response = await fetch('/api/renders', {
        method: 'POST',
        body,
        headers: attributionHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        markFailed(upload.key, localizedError(data, t('errors.upload')));
        if (data.code === 'preview_limit') {
          setNotice(t('errors.dailyLimit'));
          return false;
        }
        return true;
      }
      upsert(data as RenderView);
      captureBrowser('render_preview_created', {
        source: 'library',
        has_prompt: Boolean(upload.prompt),
      });
      dismiss(upload.key);
    } catch {
      markFailed(upload.key, t('errors.upload'));
    }
    return true;
  }

  async function sendUploads(queued: QueuedUpload[]) {
    const skipped = await pool(queued, UPLOAD_CONCURRENCY, uploadOne);
    for (const upload of skipped) markFailed(upload.key, t('errors.dailyLimit'));
  }

  async function addFiles(list: FileList | File[] | null, prompt?: string) {
    const files = Array.from(list ?? []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    setNotice(null);
    const queued: QueuedUpload[] = files.map((file) => ({
      key: crypto.randomUUID(),
      name: baseName(file),
      url: URL.createObjectURL(file),
      file,
      prompt,
      error: null,
    }));
    setUploads((current) => [...queued, ...current]);
    await sendUploads(queued);
  }

  async function retry(upload: QueuedUpload) {
    setNotice(null);
    const fresh = { ...upload, error: null };
    setUploads((current) => current.map((item) => (item.key === upload.key ? fresh : item)));
    await sendUploads([fresh]);
  }

  // The whole page takes drops, not just the empty box: the browser would otherwise open a
  // photo dropped anywhere else and leave the app. Kept in a ref so the window listeners
  // below always call the latest closure.
  const addFilesRef = useRef(addFiles);
  addFilesRef.current = addFiles;
  // use-effect-audit: ignore subscribes to window drag and drop events
  useEffect(() => {
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    };
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      void addFilesRef.current(event.dataTransfer?.files ?? null);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const pending = items.filter((item) => item.status === 'preview_ready');
  // An angle sheet bought earlier already counts toward an item's price.
  const owed = (item: RenderView) => Math.max(0, renderCredits - item.credits);
  let affordable = 0;
  let spendable = balance;
  let totalOwed = 0;
  for (const item of pending) {
    if (owed(item) > spendable) break;
    spendable -= owed(item);
    totalOwed += owed(item);
    affordable += 1;
  }

  // What building everything that is waiting would cost, against the balance.
  const buildAllCredits = pending.reduce((sum, item) => sum + owed(item), 0);
  const shortBy = Math.max(0, buildAllCredits - balance);
  const previewing =
    items.filter((item) => item.status === 'drafting').length +
    uploads.filter((upload) => !upload.error).length;

  async function build(targets: RenderView[]) {
    if (targets.length === 0) return;
    setBuilding(true);
    setNotice(null);
    let stoppedFor: string | null = null;
    try {
      const left = await pool(targets, BUILD_CONCURRENCY, async (item) => {
        try {
          const response = await fetch(`/api/renders/${item.id}/render`, { method: 'POST' });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            upsert(data as RenderView);
            captureBrowser('render_generation_started', {
              source: 'library',
              credits: owed(item),
            });
            setBalance((current) => Math.max(0, current - owed(item)));
            return true;
          }
          if (data.code === 'insufficient_credits') {
            stoppedFor = t('errors.outOfCredits');
            return false;
          }
          setNotice(localizedError(data, t('errors.someFailed')));
        } catch {
          setNotice(t('errors.connection'));
        }
        return true;
      });
      if (left.length > 0) setNotice(stoppedFor ?? t('stillWaiting', { count: left.length }));
      // Bump past the optimistic updates so the final read always lands.
      localVersion.current += 1;
      await refresh(true);
    } finally {
      setBuilding(false);
      // The header balance is a server read. Refresh it after a build, including on phones where
      // the renders drawer (and its poll) is not mounted.
      router.refresh();
    }
  }

  async function makeSheet(item: RenderView) {
    setNotice(null);
    try {
      const response = await fetch(`/api/renders/${item.id}/sheet`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        upsert(data as RenderView);
        captureBrowser('render_sheet_generation_started', {
          source: 'library',
          credits: sheetCredits,
        });
        setBalance((current) => Math.max(0, current - sheetCredits));
      } else {
        setNotice(
          data.code === 'insufficient_credits'
            ? t('errors.sheetOutOfCredits')
            : localizedError(data, t('errors.someFailed')),
        );
      }
      router.refresh();
    } catch {
      setNotice(t('errors.connection'));
    }
  }

  // A folder deleted elsewhere falls back to the whole library.
  const activeScope =
    scope === 'all' || scope === 'none' || folders.some((f) => f.id === scope) ? scope : 'all';
  const scoped = useMemo(
    () =>
      items.filter((item) =>
        activeScope === 'all'
          ? true
          : activeScope === 'none'
            ? item.folderId === null
            : item.folderId === activeScope,
      ),
    [items, activeScope],
  );
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, scoped.filter(f.match).length])),
    [scoped],
  ) as Record<Filter, number>;
  const folderCounts = useMemo(() => {
    const byFolder: Record<string, number> = {};
    for (const item of items)
      if (item.folderId) byFolder[item.folderId] = (byFolder[item.folderId] ?? 0) + 1;
    return byFolder;
  }, [items]);
  const noneCount = items.filter((item) => item.folderId === null).length;
  const visible = scoped.filter(FILTERS.find((f) => f.id === filter)?.match ?? (() => true));
  const isShowingUploads = filter === 'all' && (activeScope === 'all' || activeScope === 'none');

  // Folder calls resolve with the message to show, or null when the change was saved.
  const folderError = (code: unknown) =>
    code === 'folder_exists'
      ? t('folders.errors.exists')
      : code === 'bad_folder_name'
        ? t('folders.errors.name')
        : code === 'folder_limit'
          ? t('folders.errors.limit')
          : t('folders.errors.generic');
  async function sendFolder(path: string, method: string, body?: unknown) {
    try {
      const response = await fetch(path, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = response.status === 204 ? null : await response.json().catch(() => null);
      return { isOk: response.ok, data };
    } catch {
      return { isOk: false, data: null };
    }
  }
  const sortFolders = (list: LibraryFolderView[]) =>
    [...list].sort((a, b) => a.name.localeCompare(b.name));
  async function saveFolder(name: string) {
    const target = nameDialog?.folder;
    const result = target
      ? await sendFolder(`/api/folders/${target.id}`, 'PATCH', { name })
      : await sendFolder('/api/folders', 'POST', { name });
    if (!result.isOk) return folderError((result.data as { code?: string } | null)?.code);
    const saved = result.data as LibraryFolderView;
    localVersion.current += 1;
    setFolders((current) => sortFolders([...current.filter((f) => f.id !== saved.id), saved]));
    if (!target) setScope(saved.id);
    setNameDialog(null);
    return null;
  }
  async function removeFolder(folder: LibraryFolderView) {
    const result = await sendFolder(`/api/folders/${folder.id}`, 'DELETE');
    if (!result.isOk) return folderError((result.data as { code?: string } | null)?.code);
    localVersion.current += 1;
    setFolders((current) => current.filter((f) => f.id !== folder.id));
    setItems((current) =>
      current.map((item) => (item.folderId === folder.id ? { ...item, folderId: null } : item)),
    );
    if (scope === folder.id) setScope('all');
    setDeleting(null);
    return null;
  }
  async function moveItem(item: LibraryItemView, folderId: string | null) {
    const result = await sendFolder('/api/library/folder', 'POST', {
      renderIds: [item.id],
      folderId,
    });
    if (!result.isOk) return t('folders.errors.move');
    localVersion.current += 1;
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, folderId } : i)));
    setMoving(null);
    return null;
  }
  const total = items.length + uploads.length;

  const filterOptions = FILTERS.map((f) => ({
    id: f.id,
    label: t(`filters.${f.id}`),
    count: counts[f.id],
  }));
  const viewOptions = VIEWS.map((id) => ({ id, label: t(`views.${id}`) }));

  return (
    <div className="space-y-6">
      <ShellPanel side="left" isInline={false}>
        <LibraryPanel
          filters={filterOptions}
          filter={filter}
          onFilter={setFilter}
          views={viewOptions}
          view={view}
          onView={setView}
          folders={folders}
          folderCounts={folderCounts}
          allCount={items.length}
          noneCount={noneCount}
          scope={activeScope}
          onScope={setScope}
          onCreate={() => setNameDialog({ mode: 'create' })}
          onRename={(folder) => setNameDialog({ mode: 'rename', folder })}
          onDelete={setDeleting}
        />
      </ShellPanel>
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="flex size-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-foreground/40 text-center">
            <ImageUp className="size-10" />
            <p className="text-lg font-medium">{t('dropOverlay.title')}</p>
            <p className="text-sm text-muted-foreground">{t('dropOverlay.body')}</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => input.current?.click()}>
            <Upload className="size-4" />
            {t('upload')}
          </Button>
          {pending.length > 0 && affordable === 0 ? (
            <Button asChild>
              <Link href="/credits">
                <Sparkles className="size-4" />
                {t('buyToGenerate', { count: pending.length })}
              </Link>
            </Button>
          ) : (
            <Button
              disabled={building || affordable === 0}
              onClick={() => build(pending.slice(0, affordable))}
            >
              {building ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {affordable > 0
                ? t('generateAllCount', {
                    count: affordable,
                    credits: format.number(totalOwed),
                  })
                : t('generateAll')}
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {notice && (
        <p className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <AlertCircle className="size-4 shrink-0" />
          {notice}
          {pending.length > affordable && (
            <Link href="/credits" className="underline">
              {t('buyCredits')}
            </Link>
          )}
        </p>
      )}

      {total === 0 ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => input.current?.click()}
          className="h-auto min-h-80 w-full flex-col gap-3 border-dashed bg-muted/40 whitespace-normal text-muted-foreground hover:bg-muted"
        >
          <ImageUp className="size-8" />
          <span className="font-medium text-foreground">{t('empty.title')}</span>
          <span className="max-w-sm text-center text-sm font-normal">{t('empty.body')}</span>
          <span className="max-w-sm text-center text-xs font-normal">
            {t('empty.cost', { credits: format.number(renderCredits) })}
          </span>
        </Button>
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 text-sm tabular-nums">
            <Sparkles className="size-4 shrink-0" />
            <span>
              {t('estimate.prices', { credits: format.number(renderCredits) })}
              {previewing > 0 && ` ${t('estimate.previewing', { count: previewing })}`}
            </span>
            {pending.length > 0 && (
              <span className="font-medium">
                {t('estimate.all', {
                  count: pending.length,
                  credits: format.number(buildAllCredits),
                  balance: format.number(balance),
                })}
              </span>
            )}
            {shortBy > 0 && (
              <Link href="/credits" className="underline">
                {t('estimate.short', { credits: format.number(shortBy) })}
              </Link>
            )}
          </p>

          {/* Wide screens have these in the side panel. */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented
                value={filter}
                onChange={setFilter}
                options={filterOptions.map((o) => ({ id: o.id, label: `${o.label} ${o.count}` }))}
              />
              <Segmented value={view} onChange={setView} options={viewOptions} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Segmented
                value={activeScope}
                onChange={setScope}
                options={[
                  { id: 'all', label: t('folders.all') },
                  { id: 'none', label: t('folders.unfiled') },
                  ...folders.map((folder) => ({ id: folder.id, label: folder.name })),
                ]}
              />
              <Button variant="outline" size="sm" onClick={() => setNameDialog({ mode: 'create' })}>
                <FolderInput className="size-4" />
                {t('folders.new')}
              </Button>
            </div>
          </div>

          <div
            className={cn(
              'gap-4',
              view === 'compare'
                ? 'columns-2 md:columns-3 xl:columns-4'
                : 'columns-2 md:columns-3 xl:columns-4',
            )}
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => input.current?.click()}
              className="mb-4 h-auto w-full break-inside-avoid flex-col gap-2 border-dashed bg-muted/40 py-10 whitespace-normal text-muted-foreground hover:bg-muted"
            >
              <ImageUp className="size-6" />
              <span className="font-medium text-foreground">{t('addMore.title')}</span>
              <span className="text-xs font-normal">{t('addMore.body')}</span>
            </Button>
            {isShowingUploads &&
              uploads.map((upload) => (
                <Tile
                  key={upload.key}
                  view={view}
                  photo={upload.url}
                  title={upload.name}
                  status={upload.error ? t('errors.upload') : t('uploading')}
                  alwaysPane={Boolean(upload.error)}
                  pane={
                    upload.error ? (
                      <Pane icon={<AlertCircle className="size-5" />} text={upload.error}>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => retry(upload)}>
                            <RotateCcw className="size-4" />
                            {t('retry')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => dismiss(upload.key)}>
                            <X className="size-4" />
                            {t('dismiss')}
                          </Button>
                        </div>
                      </Pane>
                    ) : (
                      <Pane
                        icon={<Loader2 className="size-5 animate-spin" />}
                        text={t('uploading')}
                      />
                    )
                  }
                />
              ))}
            {visible.map((item) => (
              <Tile
                key={item.id}
                view={view}
                href={`/r/${item.id}`}
                photo={`/api/renders/${item.id}/source`}
                title={item.name || item.prompt || t('untitled')}
                status={t(`status.${item.status}`)}
                onMove={() => setMoving(item)}
                pane={
                  <ModelPane
                    item={item}
                    viewerReady={viewerReady}
                    canBuild={!building && balance >= owed(item)}
                    canSheet={balance >= sheetCredits}
                    renderCredits={owed(item)}
                    sheetCredits={sheetCredits}
                    onBuild={() => build([item])}
                    onSheet={() => makeSheet(item)}
                  />
                }
              />
            ))}
          </div>
          {visible.length === 0 && !(isShowingUploads && uploads.length > 0) && (
            <p className="py-12 text-center text-sm text-muted-foreground">{t('emptyView')}</p>
          )}
        </>
      )}
      {nameDialog && (
        <FolderNameDialog
          key={nameDialog.folder?.id ?? 'new'}
          mode={nameDialog.mode}
          initialName={nameDialog.folder?.name ?? ''}
          onSubmit={saveFolder}
          onClose={() => setNameDialog(null)}
        />
      )}
      {deleting && (
        <DeleteFolderDialog
          folder={deleting}
          count={folderCounts[deleting.id] ?? 0}
          onConfirm={() => removeFolder(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
      {moving && (
        <MoveDialog
          itemName={moving.name || moving.prompt || t('untitled')}
          folders={folders}
          currentId={moving.folderId}
          onPick={(folderId) => moveItem(moving, folderId)}
          onClose={() => setMoving(null)}
        />
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {options.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'h-7 px-3 text-xs text-muted-foreground pointer-coarse:h-9',
            value === option.id && 'bg-background text-foreground shadow-xs hover:bg-background',
          )}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

// A catalog card. The photo sets the card's height (that's what makes the grid masonry);
// the 3D pane sits beside it, or on top of it in 3D view.
function Tile({
  view,
  photo,
  title,
  status,
  pane,
  href,
  onMove,
  alwaysPane = false,
}: {
  view: View;
  photo: string;
  title: string;
  status: string;
  pane: ReactNode;
  href?: string;
  // Opens the folder picker for this item.
  onMove?: () => void;
  alwaysPane?: boolean;
}) {
  const t = useTranslations('Library');
  // How much of the photo shows, in percent. The 3D pane covers the rest, from the right.
  const [split, setSplit] = useState(50);
  const image = (
    // biome-ignore lint/performance/noImgElement: authenticated API image, not optimizable
    <img src={photo} alt={title} loading="lazy" className="block h-auto w-full" />
  );
  return (
    <figure className="mb-4 break-inside-avoid overflow-hidden rounded-lg border bg-card shadow-xs">
      {alwaysPane ? (
        <div className="grid grid-cols-2 gap-px bg-border">
          <div className="bg-muted/40">{image}</div>
          <div className="relative bg-muted/40">{pane}</div>
        </div>
      ) : (
        <div className="relative bg-muted/40">
          {image}
          {/* Translucent so items without a model still show which product they are. */}
          {view === '3d' && (
            <div className="absolute inset-0 bg-muted/85 backdrop-blur-sm">{pane}</div>
          )}
          {view === 'compare' && (
            <>
              <div
                className="absolute inset-0 bg-muted"
                style={{ clipPath: `inset(0 0 0 ${split}%)` }}
              >
                {pane}
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-foreground/60"
                style={{ left: `${split}%` }}
              />
            </>
          )}
        </div>
      )}
      {view === 'compare' && !alwaysPane && (
        <div className="flex items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span>{t('views.photo')}</span>
          <Slider
            value={[split]}
            onValueChange={(next) => setSplit(next[0] ?? 50)}
            min={0}
            max={100}
            step={1}
            aria-label={t('compareLabel')}
          />
          <span>{t('views.3d')}</span>
        </div>
      )}
      <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
        {href ? (
          <Link href={href} className="truncate py-1 font-medium capitalize hover:underline">
            {title}
          </Link>
        ) : (
          <span className="truncate font-medium capitalize">{title}</span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          <span className="text-xs text-muted-foreground">{status}</span>
          {onMove && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onMove}
              aria-label={t('folders.moveAria', { name: title })}
              title={t('folders.move')}
              className="-my-1 -mr-2"
            >
              <FolderInput />
            </Button>
          )}
        </span>
      </figcaption>
    </figure>
  );
}

function Pane({ icon, text, children }: { icon: ReactNode; text: string; children?: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-xs text-muted-foreground">
      {icon}
      <span>{text}</span>
      {children}
    </div>
  );
}

function ModelPane({
  item,
  viewerReady,
  canBuild,
  canSheet,
  renderCredits,
  sheetCredits,
  onBuild,
  onSheet,
}: {
  item: RenderView;
  viewerReady: boolean;
  canBuild: boolean;
  canSheet: boolean;
  renderCredits: number;
  sheetCredits: number;
  onBuild: () => void;
  onSheet: () => void;
}) {
  const t = useTranslations('Library');
  if (item.hasModel) {
    return viewerReady ? (
      <div className="absolute inset-0 bg-muted">
        <model-viewer
          src={`/api/renders/${item.id}/model`}
          alt={t('modelAlt', { name: item.name ?? t('untitled') })}
          loading="lazy"
          camera-controls
          auto-rotate
          shadow-intensity="1"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    ) : (
      <Pane icon={<Loader2 className="size-5 animate-spin" />} text={t('pane.loading')} />
    );
  }
  switch (item.status) {
    case 'drafting':
      return <Pane icon={<Loader2 className="size-5 animate-spin" />} text={t('pane.drafting')} />;
    case 'rendering':
      return <Pane icon={<Loader2 className="size-5 animate-spin" />} text={t('pane.rendering')} />;
    case 'failed':
      return <Pane icon={<AlertCircle className="size-5" />} text={t('pane.failed')} />;
    default: {
      const buy = !canBuild && !(canSheet && !item.hasSheet);
      const build = buy ? (
        <Button size="sm" asChild>
          <Link href="/credits">{t('buyCredits')}</Link>
        </Button>
      ) : (
        <Button size="sm" variant="outline" disabled={!canBuild} onClick={onBuild}>
          {t('generateOne', { credits: renderCredits })}
        </Button>
      );
      // The angle sheet is the preview: show it here, with the 3D action on top.
      if (item.hasSheet) {
        return (
          <>
            {/* biome-ignore lint/performance/noImgElement: authenticated API image, not optimizable */}
            <img
              src={`/api/renders/${item.id}/preview`}
              alt={t('sheetAlt', { name: item.name ?? t('untitled') })}
              loading="lazy"
              className="absolute inset-0 size-full bg-white object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/50 to-transparent p-2 pt-8">
              {build}
            </div>
          </>
        );
      }
      return (
        <Pane icon={<Box className="size-5" />} text={t('status.preview_ready')}>
          {canSheet && (
            <Button size="sm" variant="secondary" onClick={onSheet}>
              <Grid3x3 className="size-4" />
              {t('generateSheet', { credits: sheetCredits })}
            </Button>
          )}
          {build}
        </Pane>
      );
    }
  }
}
