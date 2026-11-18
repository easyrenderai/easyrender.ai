'use client';

import type { LibraryFolderView } from '@easyrender/core';
import { Folder, FolderMinus, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Which part of the library the grid shows: 'all', 'none' (in no folder) or a folder id.
export type FolderScope = string;

export type PanelOption<T extends string> = { id: T; label: string; count?: number };

function PanelRow({
  label,
  count,
  icon,
  isActive,
  onClick,
}: {
  label: string;
  count?: number;
  icon?: ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        'h-8 min-w-0 flex-1 justify-between gap-2 px-2 font-normal text-muted-foreground pointer-coarse:h-9',
        isActive && 'bg-accent text-foreground',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {count !== undefined && <span className="text-xs tabular-nums">{count}</span>}
    </Button>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-0.5">
      <div className="flex h-8 items-center justify-between px-2">
        <h2 className="text-xs text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// The library's own side panel: the status filters, the view and the folders. It sits in the app
// shell's left drawer on wide screens; the page shows the same choices itself on narrow ones.
export function LibraryPanel<F extends string, V extends string>({
  filters,
  filter,
  onFilter,
  views,
  view,
  onView,
  folders,
  folderCounts,
  allCount,
  noneCount,
  scope,
  onScope,
  onCreate,
  onRename,
  onDelete,
}: {
  filters: PanelOption<F>[];
  filter: F;
  onFilter: (next: F) => void;
  views: PanelOption<V>[];
  view: V;
  onView: (next: V) => void;
  folders: LibraryFolderView[];
  folderCounts: Record<string, number>;
  allCount: number;
  noneCount: number;
  scope: FolderScope;
  onScope: (next: FolderScope) => void;
  onCreate: () => void;
  onRename: (folder: LibraryFolderView) => void;
  onDelete: (folder: LibraryFolderView) => void;
}) {
  const t = useTranslations('Library');
  return (
    <nav aria-label={t('panel.title')} className="flex flex-col gap-4 px-2 py-3">
      <Section title={t('panel.status')}>
        {filters.map((option) => (
          <div key={option.id} className="flex">
            <PanelRow
              label={option.label}
              count={option.count}
              isActive={filter === option.id}
              onClick={() => onFilter(option.id)}
            />
          </div>
        ))}
      </Section>

      <Section title={t('panel.view')}>
        {views.map((option) => (
          <div key={option.id} className="flex">
            <PanelRow
              label={option.label}
              isActive={view === option.id}
              onClick={() => onView(option.id)}
            />
          </div>
        ))}
      </Section>

      <Section
        title={t('folders.title')}
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onCreate}
            aria-label={t('folders.new')}
            title={t('folders.new')}
          >
            <Plus />
          </Button>
        }
      >
        <div className="flex">
          <PanelRow
            label={t('folders.all')}
            count={allCount}
            icon={<Layers className="size-4" />}
            isActive={scope === 'all'}
            onClick={() => onScope('all')}
          />
        </div>
        <div className="flex">
          <PanelRow
            label={t('folders.unfiled')}
            count={noneCount}
            icon={<FolderMinus className="size-4" />}
            isActive={scope === 'none'}
            onClick={() => onScope('none')}
          />
        </div>
        {folders.map((folder) => (
          <div key={folder.id} className="group relative flex items-center">
            <PanelRow
              label={folder.name}
              count={folderCounts[folder.id] ?? 0}
              icon={<Folder className="size-4" />}
              isActive={scope === folder.id}
              onClick={() => onScope(folder.id)}
            />
            {/* Over the count, so the counts stay in one column while the actions are hidden. */}
            <div className="absolute inset-y-0 right-0 flex items-center rounded-md bg-accent opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onRename(folder)}
                aria-label={t('folders.renameAria', { name: folder.name })}
                title={t('folders.renameAria', { name: folder.name })}
              >
                <Pencil />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(folder)}
                aria-label={t('folders.deleteAria', { name: folder.name })}
                title={t('folders.deleteAria', { name: folder.name })}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
      </Section>
    </nav>
  );
}
