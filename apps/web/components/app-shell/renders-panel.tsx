'use client';

import { Box, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StatusDot } from './status-dot';
import { displayName, isInFlight, isKnownStatus, type ShellRender } from './types';

const REFRESH_MS = 8000;

type Group = { key: 'ready' | 'inProgress' | 'needsAttention'; items: ShellRender[] };

function RenderRow({
  render,
  now,
  isCurrent,
}: {
  render: ShellRender;
  now: number;
  isCurrent: boolean;
}) {
  const t = useTranslations('AppShell');
  const format = useFormatter();
  const hasPreview = render.status !== 'drafting' && render.status !== 'failed';
  return (
    <Link
      href={`/r/${render.id}`}
      aria-current={isCurrent ? 'page' : undefined}
      className={cn(
        '-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
        isCurrent && 'bg-accent',
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted text-muted-foreground">
        {hasPreview ? (
          // biome-ignore lint/performance/noImgElement: private, auth-gated preview route
          <img
            src={`/api/renders/${render.id}/preview`}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <Box className="size-5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {displayName(render) || t('untitled')}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <StatusDot status={render.status} className="size-1.5" />
          {isKnownStatus(render.status) ? t(`status.${render.status}`) : render.status}
        </span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {format.relativeTime(new Date(render.createdAt), now)}
      </span>
    </Link>
  );
}

// The latest renders by state, in the left drawer. While one is still building, the server
// data is re-read every few seconds, so the status shown is the pipeline's own.
export function RendersPanel({ renders, now }: { renders: ShellRender[]; now: number }) {
  const t = useTranslations('AppShell');
  const router = useRouter();
  const pathname = usePathname();
  const hasInFlight = renders.some((render) => isInFlight(render.status));

  useEffect(() => {
    if (!hasInFlight) return;
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasInFlight, router]);

  const groups: Group[] = [
    { key: 'ready', items: renders.filter((render) => render.status === 'ready') },
    { key: 'inProgress', items: renders.filter((render) => isInFlight(render.status)) },
    {
      key: 'needsAttention',
      items: renders.filter(
        (render) => render.status === 'preview_ready' || render.status === 'failed',
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background px-4 py-2">
        <p className="text-sm font-medium text-muted-foreground">{t('panel.title')}</p>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <Plus />
            {t('newModel')}
          </Link>
        </Button>
      </div>
      {renders.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">{t('panel.empty')}</p>
      ) : (
        <div className="flex flex-col gap-5 px-4 py-4">
          {groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section key={group.key} className="flex flex-col gap-1">
                <h2 className="text-xs text-muted-foreground">{t(`panel.${group.key}`)}</h2>
                {group.items.map((render) => (
                  <RenderRow
                    key={render.id}
                    render={render}
                    now={now}
                    isCurrent={pathname === `/r/${render.id}`}
                  />
                ))}
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
