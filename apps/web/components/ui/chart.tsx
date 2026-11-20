'use client';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
export type ChartConfig = Record<string, { label: string; color: string }>;
// shadcn-style chart shell: scoped semantic CSS variables, responsive canvas and accessible title.
export function ChartContainer({
  config,
  children,
  className,
  label,
  ...props
}: {
  config: ChartConfig;
  children: ComponentProps<typeof ResponsiveContainer>['children'];
  label: string;
} & ComponentProps<'div'>) {
  const style = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color]),
  ) as CSSProperties;
  return (
    <div
      data-slot="chart"
      role="img"
      aria-label={label}
      className={cn(
        'h-72 w-full min-w-0 max-w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-surface]:max-w-full [&_.recharts-surface]:outline-none',
        className,
      )}
      style={style}
      {...props}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        // A wide first guess (the old 600px) made the chart wider than a phone before measurement
        // and the page grew sideways. The measured width replaces this on the next frame.
        initialDimension={{ width: 320, height: 288 }}
      >
        {children}
      </ResponsiveContainer>
    </div>
  );
}
export const ChartTooltip = Tooltip;
export const ChartLegend = Legend;
export function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: string | number;
    dataKey?: string | number;
  }>;
  label?: ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="max-w-[min(16rem,calc(100vw-3rem))] rounded-lg border bg-background p-2.5 text-xs shadow-md">
      <div className="mb-1.5 font-medium">{label}</div>
      {payload.map((item) => (
        <div key={String(item.dataKey)} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
          <span className="min-w-0 text-muted-foreground">{item.name}</span>
          <span className="font-mono tabular-nums">
            {typeof item.value === 'number'
              ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(item.value)
              : item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
