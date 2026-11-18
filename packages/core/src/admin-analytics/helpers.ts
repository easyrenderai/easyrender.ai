export { ATTRIBUTION_KEYS as ATTRIBUTION_COLUMNS } from '../attribution';

export const DAY = 86_400_000;
export const SIGNAL_MIN_SIGNUPS = 20;
export const SECTIONS = [
  'overview',
  'revenue',
  'attribution',
  'funnel',
  'product',
  'icp',
  'health',
] as const;
export type Section = (typeof SECTIONS)[number];
export type Granularity = 'day' | 'week' | 'month';
export type Range = {
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  granularity: Granularity;
  timezone: string;
  period: string;
  includeTeam: boolean;
};
export type Cell = string | number | null;
export type Row = Record<string, Cell>;
export type Quality = 'measured' | 'proxy' | 'unavailable';
export type Metric = {
  key: string;
  value: number | null;
  previous: number | null;
  format?: 'percent' | 'currency' | 'number' | 'minutes';
  currency?: string;
  source: string;
  quality: Quality;
  lowerIsBetter?: boolean;
};
export type DataTable = {
  key: string;
  columns: string[];
  rows: Row[];
  quality: Quality;
  source: string;
  note?: string;
};
export type Chart = {
  key: string;
  kind: 'area' | 'bar' | 'donut';
  rows: Row[];
  series: string[];
  currency?: string;
};
export type View = { metrics: Metric[]; tables: DataTable[]; charts: Chart[]; notes: string[] };

export function parseEmails(value = ''): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}
export function adminDecision(
  user: { email: string; emailVerified?: boolean } | null,
  allowlist: string,
  requiresVerification = false,
): 'allow' | 'signin' | 'verify' | 'notFound' {
  if (!user) return 'signin';
  if (!parseEmails(allowlist).includes(user.email.toLowerCase())) return 'notFound';
  if (requiresVerification && user.emailVerified !== true) return 'verify';
  return 'allow';
}
export function isExcluded(email: string, entries: string[]): boolean {
  const normalized = email.toLowerCase();
  return entries.some((entry) =>
    entry.startsWith('@') ? normalized.endsWith(entry) : normalized === entry,
  );
}
export function timezone(value = 'Europe/Madrid'): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return value;
  } catch {
    return 'Europe/Madrid';
  }
}
export function localDate(date: Date | string, tz = 'Europe/Madrid'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
}
export function midnight(day: string, tz: string): Date {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    Number.isNaN(Date.parse(day)) ||
    new Date(day).toISOString().slice(0, 10) !== day
  )
    throw new Error('Invalid date');
  const target = Date.parse(`${day}T00:00:00Z`);
  let time = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(time);
    const p = Object.fromEntries(parts.map((v) => [v.type, v.value]));
    const wall = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
    time += target - wall;
  }
  return new Date(time);
}
export function bucket(date: string | Date, grain: Granularity, tz: string): string {
  const day = localDate(date, tz);
  if (grain === 'month') return `${day.slice(0, 7)}-01`;
  if (grain === 'day') return day;
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function periodRange(
  params: Record<string, string | undefined>,
  now = new Date(),
  earliest = '2020-01-01T00:00:00.000Z',
  tz = 'Europe/Madrid',
): Range {
  tz = timezone(tz);
  // Stable five-minute endpoint keeps shareable relative ranges cacheable.
  let end = new Date(Math.floor(now.getTime() / 300_000) * 300_000);
  const periods: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, '12m': 365 };
  let period = params.period ?? '30d';
  let start: Date;
  if (period === 'custom' && params.from && params.to) {
    try {
      start = midnight(params.from, tz);
      midnight(params.to, tz);
      const nextDay = new Date(`${params.to}T12:00:00Z`);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      end = new Date(
        Math.min(midnight(nextDay.toISOString().slice(0, 10), tz).getTime(), end.getTime()),
      );
      if (start >= end || end.getTime() - start.getTime() > DAY * 3660 || end > now)
        throw new Error('Invalid range');
    } catch {
      period = '30d';
      end = new Date(Math.floor(now.getTime() / 300_000) * 300_000);
      start = new Date(end.getTime() - 30 * DAY);
    }
  } else if (period === 'all')
    start = new Date(Math.min(Date.parse(earliest), end.getTime() - DAY));
  else {
    if (!periods[period]) period = '30d';
    start = new Date(end.getTime() - periods[period] * DAY);
  }
  const duration = end.getTime() - start.getTime();
  const granularity = ['day', 'week', 'month'].includes(params.granularity ?? '')
    ? (params.granularity as Granularity)
    : duration > DAY * 180
      ? 'month'
      : duration > DAY * 90
        ? 'week'
        : 'day';
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    previousStart: new Date(start.getTime() - duration).toISOString(),
    previousEnd: start.toISOString(),
    granularity,
    timezone: tz,
    period,
    includeTeam: params.team === '1',
  };
}
export const ratio = (n: number, d: number): number | null => (d > 0 ? n / d : null);
export function delta(current: number | null, previous: number | null, lowerIsBetter = false) {
  if (current === null || previous === null)
    return { percent: null, direction: 'flat', isGood: null };
  const diff = current - previous;
  return {
    percent: previous === 0 ? (current === 0 ? 0 : null) : diff / Math.abs(previous),
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    isGood: diff === 0 ? null : lowerIsBetter ? diff < 0 : diff > 0,
  };
}
export function formatNumber(value: number | null, format = 'number', currency = 'USD'): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(
    'en-GB',
    format === 'currency'
      ? { style: 'currency', currency, currencyDisplay: 'code' }
      : format === 'percent'
        ? { style: 'percent', maximumFractionDigits: 1 }
        : { maximumFractionDigits: format === 'minutes' ? 1 : 2 },
  ).format(value);
}
export function csv(columns: string[], rows: Row[]): string {
  const cell = (v: Cell | undefined) => {
    let text = String(v ?? '');
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    columns.map(cell).join(','),
    ...rows.map((row) => columns.map((key) => cell(row[key])).join(',')),
  ].join('\r\n');
}
export const AI_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'perplexity.ai',
  'gemini.google.com',
  'bard.google.com',
  'copilot.microsoft.com',
  'claude.ai',
  'you.com',
  'phind.com',
  'deepseek.com',
  'chat.deepseek.com',
  'grok.com',
  'x.ai',
  'meta.ai',
  'mistral.ai',
  'chat.mistral.ai',
  'poe.com',
  'kagi.com',
  'assistant.kagi.com',
];
const SEARCH_HOSTS = [
  'google.com',
  'bing.com',
  'duckduckgo.com',
  'yahoo.com',
  'ecosia.org',
  'search.brave.com',
  'yandex.com',
  'yandex.ru',
  'baidu.com',
];
const SOCIAL_HOSTS = [
  'facebook.com',
  'instagram.com',
  't.co',
  'x.com',
  'twitter.com',
  'linkedin.com',
  'reddit.com',
  'youtube.com',
  'tiktok.com',
  'pinterest.com',
  'threads.net',
  'threads.com',
];
export function referrerHost(value?: string | null): string {
  if (!value?.trim() || value.trim().toLowerCase() === '$direct') return '';
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname
      .toLowerCase()
      .replace(/^www\./, '');
  } catch {
    return '';
  }
}
const matchesHost = (host: string, list: string[]) =>
  list.some((domain) => host === domain || host.endsWith(`.${domain}`));
export function channel(input: {
  utm_source?: string | null;
  utm_medium?: string | null;
  referrer?: string | null;
}): string {
  const source = input.utm_source?.trim().toLowerCase() ?? '';
  const medium = input.utm_medium?.trim().toLowerCase() ?? '';
  const host = referrerHost(input.referrer);
  if (medium === 'cpc' && ['google', 'bing'].includes(source)) return 'paidSearch';
  if (
    medium === 'paid-social' &&
    ['meta', 'facebook', 'instagram', 'tiktok', 'linkedin'].includes(source)
  )
    return 'paidSocial';
  const closed: Record<string, string> = {
    'galeria-compartida': 'sharedGallery',
    directo: 'outreach',
    social: 'organicSocial',
    directorio: 'directories',
    'asistente-ia': 'ai',
    comunidad: 'communities',
    email: 'email',
    referido: 'referrals',
    sector: 'industry',
    'video-ia': 'aiVideo',
  };
  if (Object.hasOwn(closed, medium)) return closed[medium];
  if (matchesHost(source, AI_HOSTS) || (!source && matchesHost(host, AI_HOSTS))) return 'ai';
  if (source.startsWith('dir-')) return 'directories';
  if (source.startsWith('ref-')) return 'referrals';
  if (source.startsWith('sec-')) return 'industry';
  if (source.startsWith('foro-') || ['shopify-community', 'producthunt'].includes(source))
    return 'communities';
  if (
    !source &&
    !medium &&
    !matchesHost(host, ['accounts.google.com']) &&
    (matchesHost(host, SEARCH_HOSTS) || /(^|\.)google\.[a-z.]+$/.test(host))
  )
    return 'organicSearch';
  if (
    matchesHost(host, SOCIAL_HOSTS) ||
    [
      'facebook',
      'instagram',
      'x',
      'twitter',
      'linkedin',
      'reddit',
      'youtube',
      'tiktok',
      'pinterest',
      'threads',
    ].includes(source)
  )
    return 'organicSocial';
  if (!host && !source && !medium) return 'direct';
  return 'referral';
}
export function percentile(values: number[], p: number): number | null {
  const sorted = values.filter((n) => n >= 0 && Number.isFinite(n)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  return sorted[lo] + (sorted[Math.ceil(index)] - sorted[lo]) * (index - lo);
}
export function kpiFormulas(
  gross: number,
  refunds: number,
  active: number,
  paying: number,
  cost: number,
) {
  const net = gross - refunds;
  return {
    net,
    arpu: ratio(net, active),
    arppu: ratio(net, paying),
    margin: ratio(net - cost, net),
  };
}
export function funnel(values: Array<{ step: string; count: number | null }>): Row[] {
  return values.map((v, i) => ({
    ...v,
    conversion:
      i === 0
        ? null
        : v.count === null || values[i - 1].count === null
          ? null
          : ratio(v.count, values[i - 1].count as number),
    dropoff:
      i === 0 || v.count === null || !values[i - 1].count
        ? null
        : 1 - v.count / (values[i - 1].count as number),
  }));
}
export type CohortMember = {
  signup: string;
  sheet: string | null;
  model: string | null;
  purchase: string | null;
  revenue: number;
};
export function cohorts(users: CohortMember[], end: string, tz: string): Row[] {
  const groups = new Map<string, CohortMember[]>();
  for (const user of users) {
    const key = bucket(user.signup, 'week', tz);
    groups.set(key, [...(groups.get(key) ?? []), user]);
  }
  return [...groups]
    .sort(([a], [b]) => b.localeCompare(a))
    .flatMap(([week, members]) =>
      ['sheet', 'model', 'purchase'].map((step) => {
        const row: Row = {
          week,
          step,
          users: members.length,
          revenue: members.reduce((n, u) => n + u.revenue, 0),
        };
        for (let i = 0; i <= 8; i++) {
          const until = new Date(`${week}T12:00:00Z`);
          until.setUTCDate(until.getUTCDate() + (i + 1) * 7);
          const cutoff = midnight(until.toISOString().slice(0, 10), tz).getTime();
          row[`w${i}`] =
            cutoff > Date.parse(end)
              ? null
              : members.filter((u) => {
                  const event = u[step as 'sheet' | 'model' | 'purchase'];
                  return (
                    event && Date.parse(event) >= Date.parse(u.signup) && Date.parse(event) < cutoff
                  );
                }).length / members.length;
        }
        return row;
      }),
    );
}

/** Undated legacy successes stay unknown; mutable updatedAt is never a completion fallback. */
export function modelCompletedAt(render: {
  createdAt: Date;
  completedAt: Date | null;
}): Date | null {
  const completed = render.completedAt;
  return completed && Number.isFinite(+completed) && +completed >= +render.createdAt
    ? completed
    : null;
}

export const JOB_REFUND_REASONS = new Set([
  'render_failed',
  'product_views_failed',
  'product_view_polish_failed',
  'upscale_failed',
]);

export function sheetCompletedAt(render: {
  createdAt: Date;
  previewCompletedAt: Date | null;
}): Date | null {
  return modelCompletedAt({ createdAt: render.createdAt, completedAt: render.previewCompletedAt });
}
