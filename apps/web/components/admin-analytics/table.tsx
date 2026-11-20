'use client';
import {
  type Cell,
  csv,
  type DataTable,
  formatNumber,
} from '@easyrender/core/admin-analytics/helpers';
import { ArrowDownUp, Download } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const percentColumns = new Set([
  'conversion',
  'dropoff',
  'visitSignup',
  'signupPayer',
  ...Array.from({ length: 9 }, (_, i) => `w${i}`),
]);
export function AnalyticsTable({
  table,
  labels,
}: {
  table: DataTable;
  labels: Record<string, string>;
}) {
  const label = (key: string) => labels[key] ?? key;
  const [sort, setSort] = useState<{ key: string; direction: number }>({
    key: table.columns.includes('revenue') ? 'revenue' : table.columns[0],
    direction: table.columns.includes('revenue') ? -1 : 1,
  });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const id = useId();
  const filterKey = table.columns.find((k) =>
    ['product', 'source', 'currency', 'step', 'type'].includes(k),
  );
  const options = filterKey
    ? [...new Set(table.rows.map((r) => String(r[filterKey])))].slice(0, 12)
    : [];
  const rows = useMemo(
    () =>
      table.rows
        .filter(
          (r) =>
            (!query || Object.values(r).join(' ').toLowerCase().includes(query.toLowerCase())) &&
            (!filterKey || !selected.length || selected.includes(String(r[filterKey]))),
        )
        .sort((a, b) => {
          const x = a[sort.key],
            y = b[sort.key];
          return (
            (typeof x === 'number' && typeof y === 'number'
              ? x - y
              : String(x ?? '').localeCompare(String(y ?? ''))) * sort.direction
          );
        }),
    [table.rows, query, sort, filterKey, selected],
  );
  const pages = Math.max(1, Math.ceil(rows.length / 12));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * 12, (current + 1) * 12);
  function display(value: Cell, column: string) {
    if (value === null) return '—';
    if (typeof value === 'number')
      return formatNumber(value, percentColumns.has(column) ? 'percent' : 'number');
    return label(value);
  }
  function exportCsv() {
    const columns = table.columns.map(label);
    const shown = visible.map((r) =>
      Object.fromEntries(table.columns.map((key, i) => [columns[i], display(r[key], key)])),
    );
    const url = URL.createObjectURL(
      new Blob(['\ufeff', csv(columns, shown)], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${table.key}-page-${current + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{label(table.key)}</CardTitle>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download />
            {label('exportVisible')}
          </Button>
        </div>
        <CardDescription>
          {label(table.source)} · {label(table.quality)}
          {table.note ? ` · ${label(table.note)}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor={id}>{label('filter')}</Label>
          <Input
            id={id}
            className="max-w-xs"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
          {options.length > 1 &&
            options.map((value) => (
              <Label key={value} className="flex min-h-9 items-center gap-2 text-xs">
                <Checkbox
                  checked={selected.includes(value)}
                  onCheckedChange={() => {
                    setSelected((old) =>
                      old.includes(value) ? old.filter((v) => v !== value) : [...old, value],
                    );
                    setPage(0);
                  }}
                />
                {label(value)}
              </Label>
            ))}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {table.columns.map((key) => (
                <TableHead
                  key={key}
                  aria-sort={
                    sort.key === key ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'
                  }
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3"
                    onClick={() => {
                      setSort({ key, direction: sort.key === key ? -sort.direction : 1 });
                      setPage(0);
                    }}
                  >
                    {label(key)}
                    <ArrowDownUp className="size-3" />
                  </Button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={JSON.stringify(row)}>
                {table.columns.map((key) => (
                  <TableCell
                    key={key}
                    title={row[key] === null ? label('unavailable') : undefined}
                    className={
                      key === 'signal'
                        ? row[key] === 'noPayers'
                          ? 'text-destructive'
                          : row[key] === 'aboveAverage'
                            ? 'text-success'
                            : 'text-muted-foreground'
                        : percentColumns.has(key) && typeof row[key] === 'number'
                          ? 'bg-primary/5 tabular-nums'
                          : 'tabular-nums'
                    }
                    style={
                      /^w\d$/.test(key) && typeof row[key] === 'number'
                        ? {
                            backgroundColor: `color-mix(in oklch, var(--primary) ${Math.round(Number(row[key]) * 30)}%, var(--background))`,
                          }
                        : undefined
                    }
                  >
                    {display(row[key], key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {!visible.length && (
              <TableRow>
                <TableCell
                  colSpan={table.columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {label('empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {rows.length} {label('rows')} · {current + 1} / {pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              {label('previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={current === pages - 1}
              onClick={() => setPage(current + 1)}
            >
              {label('next')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
