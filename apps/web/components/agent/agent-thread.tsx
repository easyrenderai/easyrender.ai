'use client';

import { Check, ImageIcon, Loader2, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { isKnownStatus } from '@/components/app-shell/types';
import { Button } from '@/components/ui/button';
import { isAgentToolName, type Row, type ToolView } from '@/lib/agent-model';
import { cn } from '@/lib/utils';
import { AgentMarkdown } from './agent-markdown';

export type Approval = {
  toolUseId: string;
  name: string;
  title: string;
  input: Record<string, unknown>;
  credits: number;
};
export type LiveTool = { id: string; name: string; status: 'running' | 'done' | 'error' };

function useToolLabel() {
  const t = useTranslations('Agent');
  return (name: string) => (isAgentToolName(name) ? t(`tools.${name}`) : name);
}

function ToolCard({ tool }: { tool: ToolView }) {
  const t = useTranslations('Agent');
  const shell = useTranslations('AppShell');
  const label = useToolLabel();
  const hasSheet = tool.renderId && tool.hasSheet && tool.status === 'done';
  return (
    <div className="flex w-full max-w-xs flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {tool.status === 'done' && <Check className="size-4 text-foreground" />}
        {tool.status === 'error' && <TriangleAlert className="size-4 text-destructive" />}
        {tool.status === 'waiting' && <Loader2 className="size-4" />}
        <span className="font-mono">{label(tool.name)}</span>
        <span className="ml-auto">{t(`toolStatus.${tool.status}`)}</span>
      </div>
      {hasSheet && (
        <Link
          href={`/r/${tool.renderId}`}
          className="group flex flex-col gap-1.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {/* A photo or angle sheet keeps its light canvas inside a bordered frame. */}
          <span className="overflow-hidden rounded-md border bg-white">
            {/* biome-ignore lint/performance/noImgElement: private, auth-gated preview route */}
            <img
              src={`/api/renders/${tool.renderId}/preview`}
              alt={t('sheetAlt')}
              loading="lazy"
              className="block aspect-square w-full object-contain"
            />
          </span>
          <span className="text-xs text-muted-foreground group-hover:text-foreground">
            {tool.renderStatus && isKnownStatus(tool.renderStatus)
              ? shell(`status.${tool.renderStatus}`)
              : t('openRender')}
          </span>
        </Link>
      )}
    </div>
  );
}

export function AgentRow({ row }: { row: Row }) {
  const t = useTranslations('Agent');
  const format = useFormatter();
  if (row.role === 'user') {
    return (
      <div className="flex min-w-0 flex-col items-end gap-1.5">
        {row.hasPhoto && (
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
            <ImageIcon className="size-3.5" />
            {t('photoAttached')}
          </span>
        )}
        {row.text && (
          <p className="max-w-[85%] rounded-2xl bg-muted px-3.5 py-2 text-sm break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
            {row.text}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      {row.parts.map((part) =>
        part.kind === 'text' ? (
          <AgentMarkdown key={part.text} text={part.text} className="w-full" />
        ) : part.tool.status === 'waiting' ? null : (
          <ToolCard key={part.tool.id} tool={part.tool} />
        ),
      )}
      {row.credits > 0 && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {t('turnCost', { credits: format.number(row.credits) })}
        </p>
      )}
    </div>
  );
}

export function LiveRow({ text, tools }: { text: string; tools: LiveTool[] }) {
  const t = useTranslations('Agent');
  const label = useToolLabel();
  return (
    <div className="flex min-w-0 flex-col items-start gap-2" role="status" aria-live="polite">
      {text && <AgentMarkdown text={text} className="w-full" />}
      {tools.map((tool) => (
        <div
          key={tool.id}
          className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground"
        >
          {tool.status === 'running' && <Loader2 className="size-4 animate-spin" />}
          {tool.status === 'done' && <Check className="size-4 text-foreground" />}
          {tool.status === 'error' && <TriangleAlert className="size-4 text-destructive" />}
          <span className="font-mono">{label(tool.name)}</span>
        </div>
      ))}
      {!text && tools.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('working')}
        </p>
      )}
    </div>
  );
}

export function ApprovalCard({
  approval,
  isBusy,
  onDecide,
}: {
  approval: Approval;
  isBusy: boolean;
  onDecide: (decision: 'approve' | 'decline') => void;
}) {
  const t = useTranslations('Agent');
  const label = useToolLabel();
  const action = label(approval.name);
  return (
    <div
      className={cn(
        'flex max-w-sm flex-col gap-3 rounded-lg border bg-card p-3 text-card-foreground',
      )}
    >
      <p className="text-sm">
        {approval.credits > 0
          ? t('approvalCost', { action, credits: approval.credits })
          : t('approvalFree', { action })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={isBusy} onClick={() => onDecide('approve')}>
          {approval.credits > 0
            ? t('approve', { action, credits: approval.credits })
            : t('approveFree', { action })}
        </Button>
        <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onDecide('decline')}>
          {t('decline')}
        </Button>
      </div>
    </div>
  );
}
