'use client';
import {
  delta,
  formatNumber,
  type Range,
  SECTIONS,
  type Section,
  type View,
} from '@easyrender/core/admin-analytics/helpers';
import { ArrowDown, ArrowRight, ArrowUp, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { refreshAnalytics } from '@/lib/admin-analytics/actions';
import { AnalyticsChart } from './charts';
import { AnalyticsTable } from './table';
export function AdminNavigation({
  labels,
  section,
}: {
  labels: Record<string, string>;
  section: Section | 'giftCredits' | 'renderGallery';
}) {
  const params = useSearchParams();
  return (
    <nav aria-label={labels.adminNav} className="flex flex-wrap gap-1 border-b pb-4">
      {SECTIONS.map((key) => (
        <Button key={key} asChild variant={key === section ? 'secondary' : 'ghost'} size="sm">
          <Link
            prefetch={false}
            aria-current={key === section ? 'page' : undefined}
            href={`/admin/analytics${key === 'overview' ? '' : `/${key}`}?${params}`}
          >
            {labels[key]}
          </Link>
        </Button>
      ))}
      <Button asChild variant={section === 'renderGallery' ? 'secondary' : 'ghost'} size="sm">
        <Link
          prefetch={false}
          aria-current={section === 'renderGallery' ? 'page' : undefined}
          href="/admin/renders"
        >
          {labels.renderGallery}
        </Link>
      </Button>
      <Button asChild variant={section === 'giftCredits' ? 'secondary' : 'ghost'} size="sm">
        <Link
          prefetch={false}
          aria-current={section === 'giftCredits' ? 'page' : undefined}
          href="/admin/gift-credits"
        >
          {labels.giftCredits}
        </Link>
      </Button>
    </nav>
  );
}
export function AdminControls({ labels, range }: { labels: Record<string, string>; range: Range }) {
  const router = useRouter(),
    path = usePathname(),
    params = useSearchParams();
  const [isPending, start] = useTransition();
  const [from, setFrom] = useState(params.get('from') ?? range.start.slice(0, 10)),
    [to, setTo] = useState(params.get('to') ?? range.end.slice(0, 10));
  function change(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) next.set(key, value);
    start(() => router.push(`${path}?${next}`));
  }
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-1">
        {['24h', '7d', '30d', '90d', '12m', 'all'].map((period) => (
          <Button
            key={period}
            size="sm"
            variant={range.period === period ? 'default' : 'ghost'}
            onClick={() => change({ period })}
          >
            {labels[period] ?? period}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1 sm:flex-none sm:gap-2">
          {['auto', 'day', 'week', 'month'].map((granularity) => (
            <Button
              key={granularity}
              size="sm"
              variant={
                (params.get('granularity') ?? 'auto') === granularity ? 'secondary' : 'ghost'
              }
              onClick={() => change({ granularity })}
            >
              {labels[granularity]}
            </Button>
          ))}
        </div>
        <Button
          className="w-full sm:ml-auto sm:w-auto"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            start(async () => {
              await refreshAnalytics();
              router.refresh();
            })
          }
        >
          <RefreshCw className={isPending ? 'animate-spin motion-reduce:animate-none' : ''} />
          {labels.refresh}
        </Button>
      </div>
      <div className="grid grid-cols-1 items-end gap-3 min-[480px]:grid-cols-2 sm:flex sm:flex-wrap">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="admin-from">{labels.from}</Label>
          <Input
            id="admin-from"
            type="date"
            value={from}
            className="w-full sm:w-40"
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="admin-to">{labels.to}</Label>
          <Input
            id="admin-to"
            type="date"
            value={to}
            className="w-full sm:w-40"
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <Button
          className="col-span-full sm:col-span-1"
          size="sm"
          variant="outline"
          onClick={() => change({ period: 'custom', from, to })}
        >
          {labels.apply}
        </Button>
        <Label className="col-span-full flex min-h-9 items-center gap-2 sm:col-span-1 sm:ml-auto">
          <Checkbox
            checked={range.includeTeam}
            onCheckedChange={() => change({ team: range.includeTeam ? '0' : '1' })}
          />
          {labels.includeTeam}
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        {range.start.slice(0, 16).replace('T', ' ')} → {range.end.slice(0, 16).replace('T', ' ')}{' '}
        UTC · {labels.buckets}: {range.timezone} · {labels[range.granularity]}
      </p>
    </div>
  );
}
export function DashboardView({ view, labels }: { view: View; labels: Record<string, string> }) {
  const [hasCompare, setCompare] = useState(true);
  const label = (key: string) => labels[key] ?? key;
  return (
    <div className="space-y-6" data-testid="admin-report">
      {view.notes.includes('profilePlanned') && (
        <div className="grid gap-4 md:grid-cols-3">
          {['businessType', 'storePlatform', 'selfReportedCatalog'].map((key) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{label(key)}</CardTitle>
                <CardDescription>{label('profileDetails')}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
      {view.notes
        .filter((n) =>
          [
            'attributionMissing',
            'postgresUnavailable',
            'analyticsRowLimit',
            'posthogUnavailable',
            'stripeUnavailable',
            'profilePlanned',
          ].includes(n),
        )
        .map((note) => (
          <Card key={note}>
            <CardHeader>
              <CardTitle>{label(note)}</CardTitle>
              <CardDescription>
                {label(note === 'profilePlanned' ? 'profileDetails' : 'emptyHelp')}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      {view.metrics.length > 0 && (
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
          {view.metrics.map((m) => {
            const d = delta(m.value, m.previous, m.lowerIsBetter);
            const Arrow =
              d.direction === 'up' ? ArrowUp : d.direction === 'down' ? ArrowDown : ArrowRight;
            return (
              <Card key={`${m.key}-${m.currency}`} className="gap-3 py-4">
                <CardHeader className="px-4">
                  <CardDescription>{label(m.key)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 px-4">
                  <div className="text-2xl font-semibold tracking-tight tabular-nums">
                    {formatNumber(m.value, m.format, m.currency)}
                  </div>
                  <div
                    className={`flex items-center gap-1 text-xs tabular-nums ${d.isGood === true ? 'text-success' : d.isGood === false ? 'text-destructive' : 'text-muted-foreground'}`}
                  >
                    <Arrow className="size-3" />
                    {formatNumber(d.percent, 'percent')}
                    <span className="text-muted-foreground">
                      · {label('previous')}: {formatNumber(m.previous, m.format, m.currency)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {label(m.source)} · {label(m.quality)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {view.charts.length > 0 && (
        <>
          <Label className="flex min-h-9 items-center gap-2 text-sm">
            <Checkbox checked={hasCompare} onCheckedChange={() => setCompare(!hasCompare)} />
            {label('comparePrevious')}
          </Label>
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            {view.charts
              .filter((chart) => chart.key !== 'incomeUsage' || hasCompare)
              .map((chart) => (
                <AnalyticsChart
                  key={chart.key}
                  chart={chart}
                  labels={labels}
                  compare={hasCompare}
                />
              ))}
          </div>
        </>
      )}
      {view.tables.map((table) => (
        <AnalyticsTable key={table.key} table={table} labels={labels} />
      ))}
      {view.notes.length > 0 && (
        <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
          {view.notes
            .filter(
              (n) =>
                ![
                  'attributionMissing',
                  'postgresUnavailable',
                  'analyticsRowLimit',
                  'posthogUnavailable',
                  'stripeUnavailable',
                  'profilePlanned',
                ].includes(n),
            )
            .map((note) => (
              <p key={note}>{label(note)}</p>
            ))}
        </div>
      )}
    </div>
  );
}
