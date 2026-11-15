import { db, Prisma } from '@easyrender/db';
import type { Attribution as FirstTouch } from '../attribution';
import { ATTRIBUTION_COLUMNS, parseEmails } from './helpers';

export const ROW_LIMIT = 50_000;
export type Attribution = { id: string } & Omit<
  FirstTouch,
  'first_seen_at' | 'consent_region_at_create'
>;
export async function attributionColumns() {
  const columns = await db().$queryRaw<Array<{ table_name: string; column_name: string }>>`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name IN ('user', 'Render')
    AND column_name IN (${Prisma.join([...ATTRIBUTION_COLUMNS])}) LIMIT 20`;
  return Object.fromEntries(
    ['user', 'Render'].map((table) => [
      table,
      ATTRIBUTION_COLUMNS.every((col) =>
        columns.some((row) => row.table_name === table && row.column_name === col),
      ),
    ]),
  ) as { user: boolean; Render: boolean };
}
export async function loadDatabase(
  includeTeam: boolean,
  exclusions: string[],
  columns: { user: boolean; Render: boolean },
) {
  const client = db();
  const excluded = exclusions.map((entry) =>
    entry.startsWith('@')
      ? { email: { endsWith: entry, mode: 'insensitive' as const } }
      : { email: { equals: entry, mode: 'insensitive' as const } },
  );
  const userWhere: Prisma.UserWhereInput = includeTeam || !excluded.length ? {} : { NOT: excluded };
  const [users, renders, purchases, ledger, keys, earliest] = await Promise.all([
    client.user.findMany({
      where: userWhere,
      orderBy: { createdAt: 'asc' },
      take: ROW_LIMIT + 1,
      select: {
        id: true,
        email: true,
        createdAt: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
      },
    }),
    client.render.findMany({
      // An empty relation filter inside OR is discarded by Prisma, leaving only anonymous rows.
      where: includeTeam || !excluded.length ? {} : { OR: [{ userId: null }, { user: userWhere }] },
      orderBy: { createdAt: 'asc' },
      take: ROW_LIMIT + 1,
      select: {
        id: true,
        userId: true,
        anonId: true,
        status: true,
        sheetKey: true,
        glbKey: true,
        credits: true,
        costUsd: true,
        error: true,
        source: true,
        isPublic: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    client.purchase.findMany({
      where: { user: userWhere },
      orderBy: { createdAt: 'asc' },
      take: ROW_LIMIT + 1,
      select: {
        id: true,
        userId: true,
        packId: true,
        credits: true,
        amountCents: true,
        currency: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    client.creditLedger.findMany({
      where: { user: userWhere },
      orderBy: { createdAt: 'asc' },
      take: ROW_LIMIT + 1,
      select: { userId: true, delta: true, reason: true, purchaseId: true, createdAt: true },
    }),
    client.apiKey.findMany({
      where: { user: userWhere },
      orderBy: { createdAt: 'asc' },
      take: ROW_LIMIT + 1,
      select: { userId: true, createdAt: true, lastUsedAt: true },
    }),
    client.user.findFirst({
      where: userWhere,
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
  ]);
  // Existing fields use the generated client. Only columns from the coordinated PR use SQL.
  const attribution = columns.user
    ? await client.$queryRaw<Attribution[]>`
    SELECT id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_path, geo_country
    FROM "user" ORDER BY "createdAt" ASC LIMIT ${ROW_LIMIT + 1}`
    : [];
  const renderAttribution = columns.Render
    ? await client.$queryRaw<Attribution[]>`
    SELECT id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_path, geo_country
    FROM "Render" ORDER BY "createdAt" ASC LIMIT ${ROW_LIMIT + 1}`
    : [];
  const isTruncated = [
    users,
    renders,
    purchases,
    ledger,
    keys,
    attribution,
    renderAttribution,
  ].some((rows) => rows.length > ROW_LIMIT);
  // Never publish partial totals. Narrow SQL aggregates are a future scale path for this bounded snapshot.
  if (isTruncated) throw new Error('analyticsRowLimit');
  return {
    users,
    renders,
    purchases,
    ledger,
    keys,
    attribution,
    renderAttribution,
    columns,
    earliest: earliest?.createdAt.toISOString() ?? new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    isTruncated,
  };
}
export type Snapshot = Awaited<ReturnType<typeof loadDatabase>>;
export function exclusionsFromEnv() {
  return parseEmails(
    `${process.env.ADMIN_EMAILS ?? ''},${process.env.ANALYTICS_EXCLUDE_EMAILS ?? ''}`,
  );
}
