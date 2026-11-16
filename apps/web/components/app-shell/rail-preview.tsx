'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { StatusDot } from './status-dot';
import { displayName, type ShellData } from './types';

type Kind = 'overview' | 'library' | 'account';

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border bg-background px-2.5 py-2">
      <p className="text-lg font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="truncate text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Line({ lead, text, meta }: { lead?: ReactNode; text: string; meta?: string }) {
  return (
    <div className="flex h-7 items-center gap-2.5 text-sm">
      {lead}
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
    </div>
  );
}

// The peek that opens beside a rail icon: that page's three numbers and its latest items. Every
// figure comes from the same server data as the page itself.
export function RailPreview({
  kind,
  label,
  href,
  data,
}: {
  kind: Kind;
  label: string;
  href: string;
  data: ShellData;
}) {
  const t = useTranslations('AppShell');
  const format = useFormatter();
  const num = (value: number) => format.number(value);
  const ago = (iso: string) => format.relativeTime(new Date(iso), data.now);
  const { stats } = data;
  const needYou = Math.max(0, stats.total - stats.ready - stats.inFlight);

  let kpis: { value: string; label: string }[] = [];
  let caption: string | null = null;
  let lines: ReactNode = null;

  if (kind === 'overview') {
    kpis = [
      { value: num(stats.total), label: t('preview.models') },
      { value: num(stats.inFlight), label: t('preview.inProgress') },
      { value: num(stats.ready), label: t('preview.ready') },
    ];
  } else if (kind === 'library') {
    kpis = [
      { value: num(stats.total), label: t('preview.models') },
      { value: num(stats.inFlight), label: t('preview.building') },
      { value: num(needYou), label: t('preview.needYou') },
    ];
    caption = t('preview.latest');
    lines = data.renders
      .slice(0, 3)
      .map((render) => (
        <Line
          key={render.id}
          lead={<StatusDot status={render.status} />}
          text={displayName(render) || t('untitled')}
          meta={ago(render.createdAt)}
        />
      ));
  } else {
    kpis = [];
    caption = t('preview.signedIn');
    lines = <Line text={data.email} />;
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {t('preview.open')}
          <ArrowRight className="size-3" />
        </Link>
      </div>
      {kpis.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {kpis.map((kpi) => (
            <Kpi key={kpi.label} value={kpi.value} label={kpi.label} />
          ))}
        </div>
      )}
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
      {lines}
    </div>
  );
}
