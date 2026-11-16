import { db } from '@easyrender/db';
import { AppError } from '../errors';
import { type DataTable, localDate, type Range, type Row } from './helpers';

type Spend = {
  date: Date;
  platform: string;
  accountId: string;
  campaignId: string;
  campaignName: string;
  currency: string;
  costCents: number;
  clicks: number;
  impressions: number;
  importedAt?: Date;
};
type Payer = { userId: string | null; at: string; currency: string; gross: number };
type CampaignAttribution = {
  id: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
};
const campaign = (name: string) => name.toLowerCase();
const badImport = () =>
  new AppError(
    'Invalid spend import: send 1–1000 unique daily Google Ads records with valid dates, currency and nonnegative integer counters',
    400,
    'bad_spend_import',
  );

export function parseSpendImport(value: unknown): Spend[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !('records' in value) ||
    !Array.isArray(value.records) ||
    value.records.length < 1 ||
    value.records.length > 1000
  )
    throw badImport();
  const currencies = new Set(Intl.supportedValuesOf('currency'));
  const seen = new Set<string>();
  return value.records.map((input: unknown) => {
    if (!input || typeof input !== 'object') throw badImport();
    const row = input as Record<string, unknown>;
    if (
      row.platform !== 'google_ads' ||
      typeof row.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date)
    )
      throw badImport();
    const date = new Date(`${row.date}T00:00:00.000Z`);
    if (
      !Number.isFinite(+date) ||
      date.toISOString().slice(0, 10) !== row.date ||
      row.date < '2000-01-01' ||
      row.date > new Date().toISOString().slice(0, 10)
    )
      throw badImport();
    for (const key of ['accountId', 'campaignId'])
      if (typeof row[key] !== 'string' || !/^\d{1,30}$/.test(row[key] as string)) throw badImport();
    if (
      typeof row.campaignName !== 'string' ||
      !row.campaignName.trim() ||
      row.campaignName.length > 100 ||
      [...row.campaignName].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    )
      throw badImport();
    if (typeof row.currency !== 'string' || !currencies.has(row.currency)) throw badImport();
    for (const key of ['costCents', 'clicks', 'impressions'])
      if (
        typeof row[key] !== 'number' ||
        !Number.isSafeInteger(row[key]) ||
        (row[key] as number) < 0 ||
        (row[key] as number) > 2_147_483_647
      )
        throw badImport();
    const key = JSON.stringify([
      row.platform,
      row.accountId,
      row.campaignId,
      row.date,
      row.currency,
    ]);
    if (seen.has(key)) throw badImport();
    seen.add(key);
    return {
      date,
      platform: row.platform,
      accountId: row.accountId as string,
      campaignId: row.campaignId as string,
      campaignName: campaign(row.campaignName),
      currency: row.currency,
      costCents: row.costCents as number,
      clicks: row.clicks as number,
      impressions: row.impressions as number,
    };
  });
}

/** Reimporting a daily record replaces the previous value; imports never add spend twice. */
export async function importAdvertisingSpend(value: unknown) {
  const records = parseSpendImport(value);
  await db().$transaction(
    records.map((record) => {
      const { platform, accountId, campaignId, date, currency } = record;
      return db().advertisingSpend.upsert({
        where: {
          platform_accountId_campaignId_date_currency: {
            platform,
            accountId,
            campaignId,
            date,
            currency,
          },
        },
        create: record,
        update: {
          campaignName: record.campaignName,
          costCents: record.costCents,
          clicks: record.clicks,
          impressions: record.impressions,
          importedAt: new Date(),
        },
      });
    }),
  );
  return { imported: records.length };
}

/** First-touch estimate; campaign names must exactly match normalized utm_campaign. No FX or ROAS. */
export function advertisingTable(
  spends: Spend[],
  payments: Payer[],
  attribution: CampaignAttribution[],
  range: Range,
  now = new Date(),
): DataTable {
  const from = localDate(range.start, range.timezone),
    to = localDate(new Date(Date.parse(range.end) - 1), range.timezone);
  const expectedDays = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  const attrs = new Map(attribution.map((a) => [a.id, a]));
  const first = new Map<string, Payer>();
  for (const payment of payments) {
    if (!payment.userId || !(payment.gross > 0)) continue;
    const previous = first.get(payment.userId);
    if (!previous || Date.parse(payment.at) < Date.parse(previous.at))
      first.set(payment.userId, payment);
  }
  const groups = new Map<
    string,
    { name: string; currency: string; spends: Spend[]; payers: Set<string> }
  >();
  const group = (name: string, currency: string) => {
    const key = JSON.stringify([name, currency]);
    const item = groups.get(key) ?? { name, currency, spends: [], payers: new Set<string>() };
    groups.set(key, item);
    return item;
  };
  const campaignIdentities = new Map<string, Set<string>>();
  for (const row of spends) {
    if (row.platform !== 'google_ads') continue;
    const name = campaign(row.campaignName);
    const identities = campaignIdentities.get(name) ?? new Set<string>();
    identities.add(JSON.stringify([row.accountId, row.campaignId]));
    campaignIdentities.set(name, identities);
    const day = row.date.toISOString().slice(0, 10);
    if (row.platform === 'google_ads' && day >= from && day <= to)
      group(campaign(row.campaignName), row.currency).spends.push(row);
  }
  for (const [id, payer] of first) {
    if (
      Date.parse(payer.at) < Date.parse(range.start) ||
      Date.parse(payer.at) >= Date.parse(range.end)
    )
      continue;
    const attr = attrs.get(id);
    if (
      !attr?.utm_campaign ||
      !['google', 'google_ads', 'googleads'].includes(attr.utm_source ?? '') ||
      !['cpc', 'ppc', 'paidsearch', 'paid_search'].includes(attr.utm_medium ?? '')
    )
      continue;
    group(campaign(attr.utm_campaign), payer.currency).payers.add(id);
  }
  const rows: Row[] = [...groups.values()]
    .map((item) => {
      const identities = campaignIdentities.get(item.name) ?? new Set<string>();
      const days = new Set(item.spends.map((r) => r.date.toISOString().slice(0, 10)));
      const hasAmbiguousCampaign = identities.size > 1;
      const spend = item.spends.length
        ? item.spends.reduce((n, r) => n + r.costCents, 0) / 100
        : null;
      // A same-day export stays provisional after midnight until a closed-day reimport.
      const isProvisional =
        to >= localDate(now, range.timezone) ||
        item.spends.some(
          (row) =>
            !row.importedAt ||
            localDate(row.importedAt, range.timezone) <= row.date.toISOString().slice(0, 10),
        );
      const isComplete = days.size === expectedDays && !hasAmbiguousCampaign && !isProvisional;
      return {
        campaign: item.name,
        currency: item.currency,
        adSpend: spend,
        clicks: item.spends.length ? item.spends.reduce((n, r) => n + r.clicks, 0) : null,
        impressions: item.spends.length ? item.spends.reduce((n, r) => n + r.impressions, 0) : null,
        newPayers: hasAmbiguousCampaign ? null : item.payers.size,
        cacEstimate:
          isComplete && spend !== null && item.payers.size > 0 ? spend / item.payers.size : null,
        importedDays: days.size,
        expectedDays,
        spendCoverage: hasAmbiguousCampaign
          ? 'spendAmbiguous'
          : !item.spends.length
            ? 'spendMissing'
            : isProvisional
              ? 'spendProvisional'
              : isComplete
                ? 'spendComplete'
                : 'spendPartial',
      };
    })
    .sort(
      (a, b) =>
        String(a.campaign).localeCompare(String(b.campaign)) ||
        String(a.currency).localeCompare(String(b.currency)),
    );
  return {
    key: 'advertisingSpend',
    columns: [
      'campaign',
      'currency',
      'adSpend',
      'clicks',
      'impressions',
      'newPayers',
      'cacEstimate',
      'importedDays',
      'expectedDays',
      'spendCoverage',
    ],
    rows,
    source: 'mixed',
    quality: 'proxy',
    note: 'advertisingSpendScope',
  };
}
