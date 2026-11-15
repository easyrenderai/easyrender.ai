import { bucket, type DataTable, percentile, type Range, type Row } from './helpers';

export type ActivationRender = {
  id: string;
  userId: string | null;
  source: string;
  status: string;
  glbKey: string | null;
  createdAt: Date;
  completedAt: Date | null;
};
const SOURCES = ['api', 'mcp', 'web'] as const;
type Member = { source: string; firstRequest: Date; hasLegacySuccess: boolean; successes: Date[] };

/** Operational 3D activation, not analytics visitors, issued credentials, or tool handshakes. */
export function activationTables(renders: ActivationRender[], range: Range): DataTable[] {
  const end = Date.parse(range.end);
  const members = new Map<string, Member>();
  const seen = new Set<string>();
  for (const render of renders) {
    if (
      !render.userId ||
      !SOURCES.some((source) => source === render.source) ||
      +render.createdAt >= end ||
      seen.has(render.id)
    )
      continue;
    seen.add(render.id);
    const key = `${render.source}:${render.userId}`;
    const member = members.get(key) ?? {
      source: render.source,
      firstRequest: render.createdAt,
      hasLegacySuccess: false,
      successes: [],
    };
    if (+render.createdAt < +member.firstRequest) member.firstRequest = render.createdAt;
    if (render.completedAt && +render.completedAt >= +render.createdAt) {
      // Completion is a historical fact; later edits, retries or storage changes cannot undo it.
      if (+render.completedAt < end) member.successes.push(render.completedAt);
    } else if (render.status === 'ready' && render.glbKey) {
      member.hasLegacySuccess = true;
    }
    members.set(key, member);
  }
  const cohort = [...members.values()].filter(
    (member) => +member.firstRequest >= Date.parse(range.start),
  );
  for (const member of cohort) member.successes.sort((a, b) => +a - +b);
  const summarize = (items: Member[]): Row => {
    const measured = items.filter((member) => !member.hasLegacySuccess);
    const first = measured.filter((member) => member.successes.length >= 1);
    const second = measured.filter((member) => member.successes.length >= 2);
    return {
      activationAccounts: items.length,
      measuredAccounts: measured.length,
      legacyAccounts: items.length - measured.length,
      firstSuccess: first.length,
      secondSuccess: second.length,
      activationPercent: measured.length ? (first.length / measured.length) * 100 : null,
      repeatPercent: first.length ? (second.length / first.length) * 100 : null,
      firstSuccessMinutes: percentile(
        first.map((member) => (+member.successes[0] - +member.firstRequest) / 60_000),
        0.5,
      ),
      repeatMinutes: percentile(
        second.map((member) => (+member.successes[1] - +member.successes[0]) / 60_000),
        0.5,
      ),
    };
  };
  const columns = [
    'source',
    'activationAccounts',
    'measuredAccounts',
    'legacyAccounts',
    'firstSuccess',
    'secondSuccess',
    'activationPercent',
    'repeatPercent',
    'firstSuccessMinutes',
    'repeatMinutes',
  ];
  const cohorts = new Map<string, Member[]>();
  for (const member of cohort) {
    const key = `${bucket(member.firstRequest, range.granularity, range.timezone)}|${member.source}`;
    const items = cohorts.get(key) ?? [];
    items.push(member);
    cohorts.set(key, items);
  }
  return [
    {
      key: 'developerActivation',
      columns,
      rows: SOURCES.map((source) => ({
        source,
        ...summarize(cohort.filter((member) => member.source === source)),
      })),
      source: 'postgres',
      quality: 'measured',
      note: 'developerActivationDefinition',
    },
    {
      key: 'developerActivationCohorts',
      columns: ['date', ...columns],
      rows: [...cohorts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, items]) => ({
          date: key.split('|')[0],
          source: items[0].source,
          ...summarize(items),
        })),
      source: 'postgres',
      quality: 'measured',
      note: 'developerActivationCoverage',
    },
  ];
}
