'use client';
import type { OverviewPoint, OverviewSeries } from '@easyrender/core/admin-analytics';
import type { Chart } from '@easyrender/core/admin-analytics/helpers';
import { formatNumber } from '@easyrender/core/admin-analytics/helpers';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import { useMediaQuery } from '@/components/app-shell/shell-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

const colors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];
const overviewKeys = ['visits', 'payingCustomers', 'uses', 'revenue', 'newSignups'] as const;
const WIDE_CHART = '(min-width: 640px)';

function OverviewReadout({
  row,
  data,
  hidden,
  label,
  seriesLabel,
  isCompact = false,
}: {
  row: OverviewPoint;
  data: OverviewSeries;
  hidden: string[];
  label: (key: string) => string;
  seriesLabel: (key: string) => string;
  // The floating tooltip only has the numbers. The phone panel keeps the longer explanations.
  isCompact?: boolean;
}) {
  return (
    <div
      className="max-w-full rounded-lg border bg-background p-2.5 text-xs"
      data-testid="overview-tooltip"
    >
      <p className="mb-1.5 font-medium">{row.date}</p>
      {overviewKeys
        .filter((key) => key !== 'newSignups' || !hidden.includes(key))
        .map((key) => (
          <div key={key} className="mb-1.5 last:mb-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
              <span className="min-w-0">{seriesLabel(key)}</span>
              <span className="font-mono tabular-nums">
                {formatNumber(row[key], key === 'revenue' ? 'currency' : 'number', data.currency)}
              </span>
            </div>
            {key === 'payingCustomers' && !isCompact && (
              <p className="text-muted-foreground">
                {label(
                  data.heading === 'overviewPerDay'
                    ? 'payingDayHelp'
                    : data.heading === 'overviewPerWeek'
                      ? 'payingWeekHelp'
                      : 'payingMonthHelp',
                )}
              </p>
            )}
            {key === 'uses' && (
              <p className="text-muted-foreground">
                {formatNumber(row.sheets)} {label('sheetCountUnit')} + {formatNumber(row.models)}{' '}
                {label('models3d')}
              </p>
            )}
            {key === 'revenue' && !isCompact && (
              <p className="text-muted-foreground">{label('grossRevenueHelp')}</p>
            )}
            {key === 'visits' && !isCompact && data.visitsNote && (
              <p className="text-muted-foreground">{label(data.visitsNote)}</p>
            )}
          </div>
        ))}
    </div>
  );
}

export function OverviewChart({
  data,
  labels,
  hasMultipleCurrencies,
}: {
  data: OverviewSeries;
  labels: Record<string, string>;
  hasMultipleCurrencies: boolean;
}) {
  const [hidden, setHidden] = useState<string[]>(['newSignups']);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  // Below sm the floating tooltip covers the plot. The selected point is written under the chart.
  const isWideChart = useMediaQuery(WIDE_CHART);
  const label = (key: string) => labels[key] ?? key;
  const seriesLabel = (key: string) =>
    key === 'revenue' ? `${label('grossRevenueSeries')} (${data.currency})` : label(key);
  const config = Object.fromEntries(
    overviewKeys.map((key, i) => [key, { label: seriesLabel(key), color: colors[i] }]),
  );
  const countMax = Math.max(
    1,
    ...data.rows.flatMap((r) =>
      overviewKeys
        .filter((key) => key !== 'revenue' && !hidden.includes(key))
        .map((key) => r[key] ?? 0),
    ),
  );
  // Explicit square-root ticks keep small counts legible and still display real counts.
  const countTicks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((v) => Math.ceil(countMax * v * v)))];
  const activeRow =
    data.rows.find((row) => row.date === activeDate) ?? data.rows[data.rows.length - 1];
  function selectPoint(state: { activeLabel?: unknown }) {
    if (typeof state.activeLabel !== 'string' && typeof state.activeLabel !== 'number') return;
    const next = String(state.activeLabel);
    setActiveDate((current) => (current === next ? current : next));
  }
  return (
    <Card className="min-w-0 overflow-hidden sm:h-[460px]" data-testid="overview-timeseries">
      <CardHeader className="min-w-0 gap-2 px-4 sm:px-6">
        <CardTitle>{label(data.heading)}</CardTitle>
        <CardDescription>{label('overviewScale')}</CardDescription>
        {hasMultipleCurrencies && <CardDescription>{label('multipleCurrencies')}</CardDescription>}
        <fieldset
          className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 [min-inline-size:0]"
          aria-label={label('seriesToggles')}
        >
          {overviewKeys.map((key, i) => (
            <Button
              key={key}
              size="sm"
              variant={hidden.includes(key) ? 'outline' : 'secondary'}
              className="h-auto max-w-full whitespace-normal py-1 text-left"
              aria-pressed={!hidden.includes(key)}
              disabled={key === 'visits' && Boolean(data.visitsNote)}
              onClick={() =>
                setHidden((current) =>
                  current.includes(key) ? current.filter((s) => s !== key) : [...current, key],
                )
              }
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: colors[i] }}
              />
              {seriesLabel(key)}
            </Button>
          ))}
          {data.visitsNote && (
            <span className="text-xs text-muted-foreground" role="status">
              {label(data.visitsNote)}
            </span>
          )}
        </fieldset>
      </CardHeader>
      <CardContent className="min-h-0 min-w-0 space-y-3 px-4 sm:flex-1 sm:px-6">
        {!data.hasData ? (
          <div className="flex h-56 items-center justify-center text-sm text-muted-foreground sm:h-full">
            {label('empty')}
          </div>
        ) : (
          <>
            <ChartContainer className="h-64 sm:h-full" label={label(data.heading)} config={config}>
              <ComposedChart
                data={data.rows}
                margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
                onClick={selectPoint}
                onMouseMove={isWideChart ? undefined : selectPoint}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={isWideChart ? 32 : 56}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="count"
                  scale="sqrt"
                  domain={[0, countMax]}
                  ticks={countTicks}
                  width="auto"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tickMargin={4}
                />
                <YAxis
                  yAxisId="money"
                  orientation="right"
                  width="auto"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  tickFormatter={(value: number) => formatNumber(value)}
                />
                {isWideChart && (
                  <ChartTooltip
                    allowEscapeViewBox={{ x: false, y: false }}
                    wrapperStyle={{ maxWidth: '16rem', outline: 'none' }}
                    content={({ active, label: date }) => {
                      const row = data.rows.find((r) => r.date === date);
                      if (!active || !row) return null;
                      return (
                        <OverviewReadout
                          row={row}
                          data={data}
                          hidden={hidden}
                          label={label}
                          seriesLabel={seriesLabel}
                          isCompact
                        />
                      );
                    }}
                  />
                )}
                {overviewKeys.map((key, i) => (
                  <Line
                    key={key}
                    yAxisId={key === 'revenue' ? 'money' : 'count'}
                    dataKey={key}
                    name={seriesLabel(key)}
                    hide={hidden.includes(key) || (key === 'visits' && Boolean(data.visitsNote))}
                    stroke={colors[i]}
                    strokeWidth={2}
                    strokeDasharray={key === 'visits' ? '4 3' : undefined}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                    isAnimationActive={false}
                    type="linear"
                  />
                ))}
              </ComposedChart>
            </ChartContainer>
            {!isWideChart && activeRow && (
              <OverviewReadout
                row={activeRow}
                data={data}
                hidden={hidden}
                label={label}
                seriesLabel={seriesLabel}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsChart({
  chart,
  labels,
  compare,
}: {
  chart: Chart;
  labels: Record<string, string>;
  compare: boolean;
}) {
  const label = (key: string) => labels[key] ?? key;
  const series = chart.series.filter((s) => compare || !s.startsWith('previous'));
  const config = Object.fromEntries(
    series.map((s, i) => [s, { label: label(s), color: colors[i % colors.length] }]),
  );
  const data = chart.rows.map((row) => ({
    ...row,
    name: typeof row.name === 'string' ? label(row.name) : row.name,
    step: typeof row.step === 'string' ? label(row.step) : row.step,
  }));
  const x =
    chart.rows[0] &&
    ('date' in chart.rows[0]
      ? 'date'
      : 'step' in chart.rows[0]
        ? 'step'
        : 'source' in chart.rows[0]
          ? 'source'
          : 'name');
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{label(chart.key)}</CardTitle>
        <CardDescription>{chart.currency ?? label('counts')}</CardDescription>
      </CardHeader>
      <CardContent>
        {!data.length ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            {label('empty')}
          </div>
        ) : (
          <ChartContainer label={label(chart.key)} config={config}>
            {chart.kind === 'donut' ? (
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={95}
                  isAnimationActive={false}
                >
                  {data.map((row, i) => (
                    <Cell key={String(row.name)} fill={colors[i % colors.length]} />
                  ))}
                </Pie>
                <ChartTooltip
                  allowEscapeViewBox={{ x: false, y: false }}
                  wrapperStyle={{ maxWidth: '16rem', outline: 'none' }}
                  content={<ChartTooltipContent />}
                />
                <ChartLegend />
              </PieChart>
            ) : chart.kind === 'area' ? (
              <AreaChart data={data}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey={x || 'date'} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis yAxisId="money" tickLine={false} axisLine={false} width={50} />
                <YAxis
                  yAxisId="count"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <ChartTooltip
                  allowEscapeViewBox={{ x: false, y: false }}
                  wrapperStyle={{ maxWidth: '16rem', outline: 'none' }}
                  content={<ChartTooltipContent />}
                />
                <ChartLegend />
                {series.map((key, i) => (
                  <Area
                    key={key}
                    yAxisId={key.toLowerCase().includes('signups') ? 'count' : 'money'}
                    name={label(key)}
                    dataKey={key}
                    stroke={colors[i % colors.length]}
                    fill={colors[i % colors.length]}
                    fillOpacity={key.startsWith('previous') ? 0 : 0.08}
                    strokeDasharray={key.startsWith('previous') ? '5 5' : undefined}
                    isAnimationActive={false}
                    type="monotone"
                  />
                ))}
              </AreaChart>
            ) : (
              <BarChart data={data} layout={chart.key === 'channels' ? 'vertical' : 'horizontal'}>
                <CartesianGrid vertical={false} />
                <XAxis
                  type={chart.key === 'channels' ? 'number' : 'category'}
                  dataKey={chart.key === 'channels' ? undefined : x || 'date'}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={20}
                />
                <YAxis
                  type={chart.key === 'channels' ? 'category' : 'number'}
                  dataKey={chart.key === 'channels' ? 'name' : undefined}
                  tickLine={false}
                  axisLine={false}
                  width={chart.key === 'channels' ? 110 : 40}
                />
                <ChartTooltip
                  allowEscapeViewBox={{ x: false, y: false }}
                  wrapperStyle={{ maxWidth: '16rem', outline: 'none' }}
                  content={<ChartTooltipContent />}
                />
                <ChartLegend />
                {series.map((key, i) => (
                  <Bar
                    key={key}
                    name={label(key)}
                    dataKey={key}
                    fill={colors[i % colors.length]}
                    stackId={
                      ['generation', 'revenueTime'].includes(chart.key) ? 'total' : undefined
                    }
                    radius={3}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            )}
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
