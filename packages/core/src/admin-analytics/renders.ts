import { db, type Prisma, type RenderStatus } from '@easyrender/db';
import { maskEmail } from './masking';

export type AdminRender = {
  id: string;
  email: string;
  createdAt: string;
  status: RenderStatus;
  credits: number;
  hasModel: boolean;
  hasSheet: boolean;
  hasSource: boolean;
};
const STATUSES: RenderStatus[] = ['drafting', 'preview_ready', 'rendering', 'ready', 'failed'];
export function renderFilters(page?: string, status?: string) {
  const parsed = Number(page);
  return {
    page: Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 100_000) : 1,
    status: STATUSES.includes(status as RenderStatus) ? (status as RenderStatus) : undefined,
  };
}

/** Explicit cross-owner admin inventory. Never use the owner API or poll/advance a render here. */
export async function loadAdminRenders(page?: string, status?: string) {
  const filters = renderFilters(page, status);
  const where: Prisma.RenderWhereInput = { status: filters.status };
  const pageSize = 24;
  return db().$transaction(
    async (client) => {
      const total = await client.render.count({ where });
      const pages = Math.max(1, Math.ceil(total / pageSize));
      const current = Math.min(filters.page, pages);
      const rows = await client.render.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (current - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          user: { select: { email: true } },
          createdAt: true,
          status: true,
          credits: true,
          glbKey: true,
          sheetKey: true,
          sourceKey: true,
        },
      });
      const renders: AdminRender[] = rows.map((row) => ({
        id: row.id,
        email: maskEmail(row.user?.email),
        createdAt: row.createdAt.toISOString(),
        status: row.status,
        credits: row.credits,
        hasModel: Boolean(row.glbKey),
        hasSheet: Boolean(row.sheetKey),
        hasSource: Boolean(row.sourceKey),
      }));
      return { renders, total, page: current, pages, status: filters.status };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
