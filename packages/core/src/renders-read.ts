import { db, type Render } from '@easyrender/db';
import {
  BUILD_QUALITY_CREDITS,
  type BuildQuality,
  isBuildQuality,
  RENDER_CREDITS,
  SHEET_CREDITS,
  UPSCALE_CREDITS,
} from '@easyrender/harness';
import { AppError, notFound } from './errors';
import { type RenderEditView, toEditView } from './render-edits';
import { type RenderQuality, storedQuality } from './render-quality';
import { advance } from './renders-advance';
import { type Actor, canAccess, canView, type RenderSource } from './renders-shared';

// Reads a render and its lists. Only `getRender` moves a pipeline: it nudges a running render.
const POLL_INTERVAL_MS = 5000;

export type RenderView = {
  id: string;
  status: Render['status'];
  prompt: string | null;
  name: string | null;
  error: string | null;
  failureReason?: 'repeated_views' | 'inconsistent_structure';
  failedStep?: 'preview' | 'model';
  refundedCredits?: number;
  refundedCorrectionCredits?: number;
  hasPreview: boolean;
  // True once the 3x3 angle sheet exists. Without it the preview is the plain photo.
  hasSheet: boolean;
  // What the owner last asked to fix in the sheet, to prefill the next redraw.
  sheetNote: string | null;
  hasModel: boolean;
  // Changes when the render does, including its material edits: a viewer adds it to the model URL
  // so it never shows a cached copy of an older look.
  modelVersion: number;
  credits: number;
  renderCredits: number;
  // What each build quality costs in all, and the one this render was built at (Low unless the
  // owner chose a higher one).
  qualityCredits: Record<BuildQuality, number>;
  buildQuality: BuildQuality;
  // A finished Medium or High model can be rebuilt in Standard for free; this is what the owner
  // gets back when they do. Zero when the render cannot be rebuilt.
  rebuildRefundCredits: number;
  sheetCredits: number;
  // What enlarging the angle sheet costs, and whether it can be done yet (the 3D model is paid).
  upscaleCredits: number;
  canUpscale: boolean;
  isPublic: boolean;
  source: RenderSource;
  createdAt: string;
};

export function toView(render: Render): RenderView {
  const failureReason =
    render.status === 'failed'
      ? render.error?.includes('sheet_repeated_views')
        ? 'repeated_views'
        : render.error?.includes('sheet_inconsistent_structure')
          ? 'inconsistent_structure'
          : undefined
      : undefined;
  const quality = storedQuality(render);
  const refundedCorrectionCredits =
    render.status === 'preview_ready' ? quality.refundedCorrectionCredits : 0;
  return {
    id: render.id,
    status: render.status,
    prompt: render.prompt,
    name: render.name,
    error:
      render.status === 'failed'
        ? failureReason === 'inconsistent_structure'
          ? 'The generated angles changed the object structure. Try another photo. Credits, if any, were refunded.'
          : failureReason === 'repeated_views'
            ? 'We could not generate distinct angles. Try another photo. Credits, if any, were refunded.'
            : 'Generation failed. Credits, if any, were refunded.'
        : null,
    ...(failureReason ? { failureReason } : {}),
    ...(render.status === 'failed' && quality.failedStep ? { failedStep: quality.failedStep } : {}),
    ...(render.status === 'failed' && render.userId && render.credits > 0
      ? { refundedCredits: render.credits }
      : {}),
    ...(refundedCorrectionCredits ? { refundedCorrectionCredits } : {}),
    hasPreview: render.status !== 'drafting' && render.status !== 'failed',
    hasSheet: Boolean(render.sheetKey),
    sheetNote: render.sheetNote,
    hasModel: render.status === 'ready' && Boolean(render.glbKey),
    modelVersion: render.updatedAt.getTime(),
    // A failed render was refunded in full, so nothing counts as spent on it.
    credits: render.status === 'failed' ? 0 : render.credits,
    renderCredits: RENDER_CREDITS,
    qualityCredits: { ...BUILD_QUALITY_CREDITS },
    buildQuality: isBuildQuality(render.buildQuality) ? render.buildQuality : 'low',
    rebuildRefundCredits:
      render.status === 'ready' && isBuildQuality(render.buildQuality)
        ? Math.max(0, render.credits - RENDER_CREDITS)
        : 0,
    sheetCredits: SHEET_CREDITS,
    upscaleCredits: UPSCALE_CREDITS,
    canUpscale: Boolean(render.sheetKey) && (render.status === 'ready' || render.hasFinalSheet),
    isPublic: render.isPublic,
    source: render.source as RenderSource,
    createdAt: render.createdAt.toISOString(),
  };
}

// Reads a render the actor may see (their own, or a public one), nudging its pipeline forward
// when it is still running.
// The render's history, newest first. Only the owner can read it.
export async function listEdits(id: string, actor: Actor): Promise<RenderEditView[]> {
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !canAccess(render, actor)) throw notFound();
  if (!actor.userId || render.userId !== actor.userId) return [];
  const rows = await db().renderEdit.findMany({
    where: { renderId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map(toEditView).filter((edit): edit is RenderEditView => edit !== null);
}

// Diagnostic read-back for the owner. Public/link sharing never exposes QA artifacts, and
// this read cannot advance a generation or start provider work.
export async function getRenderQuality(id: string, actor: Actor): Promise<RenderQuality> {
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !canAccess(render, actor)) throw notFound();
  const quality = storedQuality(render);
  return {
    photo: quality.photo,
    draftSheet: quality.draftSheet,
    sheetRecoveryAttempts: quality.sheetRecoveryAttempts,
    finalSheet: quality.finalSheet,
    isDraftUsed: quality.isDraftUsed,
    finalSheetProblem: quality.finalSheetProblem,
    glb: quality.glb,
    fidelity: quality.fidelity ? { report: quality.fidelity.report } : undefined,
  };
}

export async function getRender(id: string, actor: Actor): Promise<Render> {
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !canView(render, actor)) throw notFound();
  if (render.status === 'drafting' || render.status === 'rendering') {
    const now = new Date();
    const next = new Date(now.getTime() + POLL_INTERVAL_MS);
    const claimed = await db().$executeRaw`UPDATE "Render" SET "pollAfter" = ${next}
      WHERE "id" = ${id} AND ("pollAfter" IS NULL OR "pollAfter" <= ${now})`;
    if (!claimed) return render;
    return (await advance(id)) ?? render;
  }
  return render;
}

const IN_FLIGHT: Render['status'][] = ['drafting', 'rendering'];
const MAX_ADVANCE_PER_LIST = 8;

export type RenderPageInput = { cursor?: string; limit?: number; status?: Render['status'] };

export async function listRenderPage(userId: string, input: RenderPageInput = {}) {
  const limit = input.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError('Limit must be an integer from 1 to 100', 400, 'bad_limit');
  }
  if (
    input.status &&
    !['drafting', 'preview_ready', 'rendering', 'ready', 'failed'].includes(input.status)
  ) {
    throw new AppError('Unknown render status', 400, 'bad_status');
  }
  let cursor: { id: string; createdAt: Date } | null = null;
  if (input.cursor) {
    try {
      if (input.cursor.length > 512) throw new Error('too long');
      const parsed = JSON.parse(Buffer.from(input.cursor, 'base64url').toString());
      const date = new Date(parsed.createdAt);
      if (
        typeof parsed.id !== 'string' ||
        !parsed.id ||
        parsed.id.length > 128 ||
        !Number.isFinite(date.getTime())
      ) {
        throw new Error('invalid');
      }
      cursor = { id: parsed.id, createdAt: date };
    } catch {
      throw new AppError('Invalid render cursor', 400, 'bad_cursor');
    }
  }
  const rows = await db().render.findMany({
    where: {
      userId,
      ...(input.status ? { status: input.status } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
  const renders = rows.slice(0, limit);
  const last = renders.at(-1);
  const nextCursor =
    rows.length > limit && last
      ? Buffer.from(
          JSON.stringify({
            id: last.id,
            createdAt: last.createdAt.toISOString(),
          }),
        ).toString('base64url')
      : null;
  return { renders, nextCursor };
}

// The user's whole catalog, newest first. Nudges a few in-flight items forward so the
// library makes progress even where Replicate cannot call the webhook (local dev).
export async function listLibrary(userId: string, take = 500): Promise<Render[]> {
  const renders = await db().render.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
  });
  const stale = renders
    .filter((render) => IN_FLIGHT.includes(render.status))
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
    .slice(0, MAX_ADVANCE_PER_LIST);
  if (stale.length === 0) return renders;
  const advanced = new Map(
    (await Promise.all(stale.map((render) => getRender(render.id, { userId }))))
      .filter((render) => render !== null)
      .map((render) => [render.id, render]),
  );
  return renders.map((render) => advanced.get(render.id) ?? render);
}

// Shows or hides a render in the public gallery. Only its owner can.
export async function setVisibility(id: string, actor: Actor, isPublic: boolean): Promise<Render> {
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !canAccess(render, actor)) throw notFound();
  if (!actor.userId || render.userId !== actor.userId) {
    throw new AppError('Sign in to change who can see this render', 401, 'sign_in');
  }
  return db().render.update({ where: { id }, data: { isPublic } });
}

export function listPublicRenders(take = 12) {
  return db().render.findMany({
    where: { isPublic: true, status: 'ready', glbKey: { not: null } },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export function listRenders(userId: string, take = 24) {
  return db().render.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take });
}

export type DashboardStats = {
  total: number;
  ready: number;
  inFlight: number;
  byAgent: number;
};

// Counts for the dashboard overview. "By agent" covers both MCP and API-key renders.
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const groups = await db().render.groupBy({
    by: ['status', 'source'],
    where: { userId },
    _count: { _all: true },
  });
  const stats: DashboardStats = { total: 0, ready: 0, inFlight: 0, byAgent: 0 };
  for (const group of groups) {
    const count = group._count._all;
    stats.total += count;
    if (group.status === 'ready') stats.ready += count;
    if (IN_FLIGHT.includes(group.status)) stats.inFlight += count;
    if (group.source !== 'web') stats.byAgent += count;
  }
  return stats;
}
