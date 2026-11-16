'use client';

import type { RenderEditView } from '@easyrender/core';
import { Box, Grid3x3, type LucideIcon, Palette, RefreshCw } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

const ICONS: Record<RenderEditView['kind'], LucideIcon> = {
  sheet: Grid3x3,
  sheet_redraw: RefreshCw,
  build: Box,
  material: Palette,
};

// The steps taken on one render, newest first. `now` comes from the server so the relative times
// read the same on the server and in the browser.
export function RenderHistory({ edits, now }: { edits: RenderEditView[]; now: number }) {
  const t = useTranslations('Render.history');
  const format = useFormatter();
  if (edits.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{t('empty')}</p>;
  }
  return (
    <ol className="flex flex-col gap-1 p-2">
      {edits.map((edit) => {
        const Icon = ICONS[edit.kind];
        return (
          <li key={edit.id} className="flex gap-3 rounded-lg px-2 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t(`kind.${edit.kind}`)}</p>
              {edit.note && (
                <p className="text-sm break-words text-muted-foreground">{edit.note}</p>
              )}
              <p className="text-xs text-muted-foreground tabular-nums">
                {format.relativeTime(new Date(edit.createdAt), now)}
                {edit.credits > 0 && ` · ${t('credits', { credits: format.number(edit.credits) })}`}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
