import { type Range, SECTIONS, type Section } from '@easyrender/core/admin-analytics/helpers';
import { notFound } from 'next/navigation';
import { getMessages, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { OverviewChart } from '@/components/admin-analytics/charts';
import {
  AdminControls,
  AdminNavigation,
  DashboardView,
} from '@/components/admin-analytics/dashboard';
import { SpendImport } from '@/components/admin-analytics/spend-import';
import { AnalyticsTable } from '@/components/admin-analytics/table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { requireAdmin } from '@/lib/admin-analytics/auth';
import {
  adminRange,
  DATABASE_METRICS,
  dashboardData,
  databaseCards,
  trafficData,
} from '@/lib/admin-analytics/data';
export async function generateMetadata() {
  const t = await getTranslations('AdminAnalytics');
  return { title: t('title') };
}
function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="h-40">
          <CardHeader>
            <div className="h-4 w-24 animate-pulse motion-reduce:animate-none rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-32 animate-pulse motion-reduce:animate-none rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
function OverviewSkeleton() {
  return (
    <Card className="h-[560px] sm:h-[460px]" aria-busy="true">
      <CardContent className="h-full">
        <div className="h-full animate-pulse motion-reduce:animate-none rounded bg-muted" />
      </CardContent>
    </Card>
  );
}
async function Overview({ range, labels }: { range: Range; labels: Record<string, string> }) {
  const data = await dashboardData('overview', range);
  return data.overview ? (
    <OverviewChart
      data={data.overview}
      labels={labels}
      hasMultipleCurrencies={data.view.notes.includes('multipleCurrencies')}
    />
  ) : (
    <Card className="h-[560px] sm:h-[460px]">
      <CardHeader>{labels[data.view.notes[0] ?? 'postgresUnavailable']}</CardHeader>
    </Card>
  );
}
async function Report({
  section,
  range,
  labels,
}: {
  section: Section;
  range: Range;
  labels: Record<string, string>;
}) {
  const data = await dashboardData(section, range);
  if (section === 'overview')
    data.view.metrics = data.view.metrics.filter(
      (metric) => !DATABASE_METRICS.includes(metric.key),
    );
  return (
    <>
      <div
        data-testid="admin-complete"
        className="flex flex-wrap gap-4 text-xs text-muted-foreground"
      >
        {data.health.map((source) => (
          <p key={source.source}>
            {labels[source.source]} · {labels.dataAsOf}{' '}
            {source.fetchedAt
              ? new Intl.DateTimeFormat('en-GB', {
                  timeZone: range.timezone,
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(source.fetchedAt))
              : '—'}
          </p>
        ))}
      </div>
      <DashboardView view={data.view} labels={labels} />
      {section === 'health' && (
        <AnalyticsTable
          labels={labels}
          table={{
            key: 'health',
            columns: [
              'source',
              'configured',
              'fetchedAt',
              'rowCount',
              'error',
              'missing',
              'isTruncated',
            ],
            rows: data.health.map((h) => ({
              source: h.source,
              configured: h.configured ? 'yes' : 'no',
              fetchedAt: h.fetchedAt,
              rowCount: h.rowCount,
              error: h.error,
              missing: h.missing.join(', '),
              isTruncated: h.isTruncated ? 'yes' : 'no',
            })),
            source: 'mixed',
            quality: 'measured',
          }}
        />
      )}
    </>
  );
}
async function DatabaseCards({ range, labels }: { range: Range; labels: Record<string, string> }) {
  return <DashboardView view={await databaseCards(range)} labels={labels} />;
}
async function Traffic({ range, labels }: { range: Range; labels: Record<string, string> }) {
  const data = await trafficData(range);
  return (
    <AnalyticsTable
      labels={labels}
      table={{
        key: 'traffic',
        columns: ['date', 'visits', 'pageviews', 'uniqueVisitors'],
        rows: data.series,
        source: 'posthog',
        quality: data.health.configured && !data.health.error ? 'proxy' : 'unavailable',
        note: 'visitsCaveat',
      }}
    />
  );
}
export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const route = await params;
  const section = (route.section?.[0] ?? 'overview') as Section;
  if ((route.section?.length ?? 0) > 1 || !SECTIONS.includes(section)) notFound();
  const search = Object.fromEntries(
    Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const range = await adminRange(search);
  const t = await getTranslations('AdminAnalytics');
  const labels = (await getMessages()).AdminAnalytics.labels as Record<string, string>;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t('eyebrow')}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{labels[section]}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
          {t('internal')}
        </span>
      </header>
      <AdminNavigation labels={labels} section={section} />
      <AdminControls labels={labels} range={range} />
      {section === 'attribution' && <SpendImport labels={labels} />}
      {section === 'overview' && (
        <Suspense fallback={<OverviewSkeleton />}>
          <Overview range={range} labels={labels} />
        </Suspense>
      )}
      {section === 'overview' && (
        <Suspense fallback={<Skeleton />}>
          <DatabaseCards range={range} labels={labels} />
        </Suspense>
      )}
      <Suspense fallback={<Skeleton />}>
        <Report section={section} range={range} labels={labels} />
      </Suspense>
      {section === 'overview' && (
        <Suspense fallback={<Skeleton />}>
          <Traffic range={range} labels={labels} />
        </Suspense>
      )}
    </div>
  );
}
