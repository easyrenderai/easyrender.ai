import { db, type Upscale } from '@easyrender/db';
import {
  createReplicate,
  download,
  ENLARGE_MODEL,
  enlargeFactor,
  enlargeRequest,
  imageSide,
  isSettled,
  ProviderRequestError,
  sheetOutputUrl,
  UPSCALE_CREDITS,
} from '@easyrender/harness';
import sharp from 'sharp';
import { config } from './config';
import { grantCreditsInTransaction, spendCreditsInTransaction } from './credits';
import { AppError, notFound } from './errors';
import {
  type Actor,
  assertAuthorizedCredits,
  assertGenerationConcurrency,
  lockRenderActor,
} from './renders';
import { reportError } from './report';
import { getFile, putFile } from './storage';

// A paid enlargement of a picture the owner already has: a product view, or the angle
// sheet of a paid render (a free preview stays watermarked, so it cannot be bought clean here). One credit charge per picture, taken before the upscaler runs and
// refunded if it gives nothing back. The original is never touched.

// An upscale takes seconds to a minute; one still running after this has been lost.
const STALE_MS = 10 * 60 * 1000;

export const UPSCALE_KINDS = ['view', 'sheet'] as const;
export type UpscaleKind = (typeof UPSCALE_KINDS)[number];
export const isUpscaleKind = (value: unknown): value is UpscaleKind =>
  typeof value === 'string' && (UPSCALE_KINDS as readonly string[]).includes(value);

export type UpscaleTarget =
  | { kind: 'view'; viewSetId: string; view: string }
  | { kind: 'sheet'; renderId: string };

export type UpscaleView = {
  id: string;
  kind: UpscaleKind;
  renderId: string | null;
  viewSetId: string | null;
  view: string | null;
  status: Upscale['status'];
  hasImage: boolean;
  width: number | null;
  height: number | null;
  credits: number;
  createdAt: string;
};

export function toUpscaleView(row: Upscale): UpscaleView | null {
  if (!isUpscaleKind(row.kind)) return null;
  return {
    id: row.id,
    kind: row.kind,
    renderId: row.renderId,
    viewSetId: row.viewSetId,
    view: row.view,
    status: row.status,
    hasImage: Boolean(row.key),
    width: row.width,
    height: row.height,
    credits: row.credits,
    createdAt: row.createdAt.toISOString(),
  };
}

// Reads the body of a create request into a target, or says what is wrong with it.
export function getUpscaleTarget(body: unknown): UpscaleTarget {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === 'string' && value ? value : null);
  if (input.kind === 'view') {
    const viewSetId = text(input.viewSetId);
    const view = text(input.view);
    if (viewSetId && view) return { kind: 'view', viewSetId, view };
  } else if (input.kind === 'sheet') {
    const renderId = text(input.renderId);
    if (renderId) return { kind: 'sheet', renderId };
  }
  throw new AppError('Say which picture to upscale', 400, 'bad_request');
}

const replicate = () => createReplicate(config.replicateToken());
const webhook = (id: string) => config.webhookUrl(`/api/webhooks/replicate?upscale=${id}`);

type Source = { key: string; where: { renderId?: string; viewSetId?: string; view?: string } };

// The stored picture a target stands for, once the actor is known to own it.
async function resolveSource(target: UpscaleTarget, userId: string): Promise<Source> {
  if (target.kind === 'view') {
    const set = await db().viewSet.findUnique({
      where: { id: target.viewSetId },
      include: { views: true },
    });
    if (!set || set.userId !== userId) throw notFound();
    const view = set.views.find((item) => item.view === target.view);
    if (!view?.key || view.status !== 'ready') {
      throw new AppError('Wait until this view is ready', 409, 'bad_state');
    }
    return { key: view.key, where: { viewSetId: set.id, view: view.view } };
  }
  const render = await db().render.findUnique({ where: { id: target.renderId } });
  if (!render || render.userId !== userId) throw notFound();
  // The sheet of a free preview carries a watermark on screen; only a paid one is enlarged clean.
  const isPaid = render.status === 'ready' || render.hasFinalSheet;
  if (!render.sheetKey || !isPaid) {
    throw new AppError('Build the 3D model first to upscale its sheet', 409, 'bad_state');
  }
  return { key: render.sheetKey, where: { renderId: render.id } };
}

// Enlarges one picture. Asking again for the same picture returns the earlier enlargement and
// charges nothing. Returns the row; the caller polls `getUpscale` until it is ready.
export async function startUpscale(target: UpscaleTarget, actor: Actor): Promise<Upscale> {
  if (!actor.userId) throw new AppError('Sign in to upscale', 401, 'sign_in');
  const userId = actor.userId;
  const source = await resolveSource(target, userId);

  const existing = await db().upscale.findFirst({
    where: {
      userId,
      kind: target.kind,
      sourceKey: source.key,
      status: { in: ['processing', 'ready'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;

  const bytes = await getFile(source.key);
  const scale = enlargeFactor(await imageSide(bytes));
  if (scale === null) {
    throw new AppError('This picture is already large enough to print', 409, 'already_large');
  }

  const reservation = await db().$transaction(async (tx) => {
    await lockRenderActor(tx, actor);
    const existing = await tx.upscale.findFirst({
      where: {
        userId,
        kind: target.kind,
        sourceKey: source.key,
        status: { in: ['processing', 'ready'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return { row: existing, isNew: false };
    assertAuthorizedCredits(UPSCALE_CREDITS, actor);
    await assertGenerationConcurrency(actor, tx);
    const row = await tx.upscale.create({
      data: {
        userId,
        kind: target.kind,
        ...source.where,
        sourceKey: source.key,
        scale,
        credits: UPSCALE_CREDITS,
      },
    });
    await spendCreditsInTransaction(tx, {
      apiKeyId: actor.apiKeyId,
      userId,
      amount: UPSCALE_CREDITS,
      key: `upscale:${row.id}`,
      reason: 'upscale',
      renderId: source.where.renderId,
    });
    return { row, isNew: true };
  });
  const { row } = reservation;
  if (!reservation.isNew) return row;

  let hasStarted = false;
  try {
    const client = replicate();
    // Sent as a high-quality JPEG: a 2K PNG can be larger than the upscaler accepts.
    const jpeg = await sharp(bytes).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
    const imageUrl = await client.upload(new Uint8Array(jpeg), 'picture.jpg', 'image/jpeg');
    const request = enlargeRequest(imageUrl);
    const prediction = await client.start(request.path, request.body, webhook(row.id));
    hasStarted = true;
    await db().upscale.updateMany({
      where: {
        id: row.id,
        status: 'processing',
        predictionId: row.predictionId,
        updatedAt: row.updatedAt,
      },
      data: { predictionId: prediction.id },
    });
    return await db().upscale.findUniqueOrThrow({ where: { id: row.id } });
  } catch (error) {
    reportError(error, { upscaleId: row.id, stage: 'upscale_start' });
    if (hasStarted || (error instanceof ProviderRequestError && error.isAmbiguous)) return row;
    await failUpscale(row);
    throw new AppError(
      'Could not upscale this picture. Your credits were refunded.',
      502,
      'upstream',
    );
  }
}

async function failUpscale(row: Upscale): Promise<Upscale> {
  await db().$transaction(async (tx) => {
    const { count } = await tx.upscale.updateMany({
      where: { id: row.id, status: 'processing', updatedAt: row.updatedAt },
      data: { status: 'failed', predictionId: null },
    });
    if (!count) return;
    await grantCreditsInTransaction(tx, {
      userId: row.userId,
      amount: row.credits,
      key: `refund:upscale:${row.id}`,
      reason: 'upscale_failed',
      renderId: row.renderId ?? undefined,
    });
  });
  return (await db().upscale.findUnique({ where: { id: row.id } })) ?? row;
}

// Moves a running upscale on: reads the prediction from Replicate itself (the webhook payload is
// never trusted), stores the larger picture, or refunds when there is none.
export async function advanceUpscale(id: string): Promise<Upscale | null> {
  const row = await db().upscale.findUnique({ where: { id } });
  if (row?.status !== 'processing') return row;
  if (!row.predictionId) {
    return Date.now() - row.updatedAt.getTime() > STALE_MS ? failUpscale(row) : row;
  }
  try {
    const prediction = await replicate().get(row.predictionId);
    if (!isSettled(prediction.status)) {
      return Date.now() - row.updatedAt.getTime() > STALE_MS ? failUpscale(row) : row;
    }
    const url = prediction.status === 'succeeded' ? sheetOutputUrl(prediction.output) : null;
    if (!url) return failUpscale(row);
    // Keep the provider id until the result is durably saved; transient download/storage failures retry.
    const larger = await sharp(await download(url))
      .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
      .toBuffer({ resolveWithObject: true });
    const key = await putFile('upscales/upscale.jpg', new Uint8Array(larger.data), 'image/jpeg');
    await db().upscale.updateMany({
      where: {
        id: row.id,
        status: 'processing',
        predictionId: row.predictionId,
        updatedAt: row.updatedAt,
      },
      data: {
        status: 'ready',
        predictionId: null,
        key,
        width: larger.info.width,
        height: larger.info.height,
        costUsd: ENLARGE_MODEL.costUsd,
      },
    });
    return db().upscale.findUnique({ where: { id } });
  } catch (error) {
    reportError(error, { upscaleId: row.id, stage: 'upscale_retryable' });
    return Date.now() - row.updatedAt.getTime() > STALE_MS ? failUpscale(row) : row;
  }
}

async function ownedUpscale(id: string, actor: Actor): Promise<Upscale> {
  if (!actor.userId) throw new AppError('Sign in to see your upscales', 401, 'sign_in');
  const row = await db().upscale.findUnique({ where: { id } });
  if (!row || row.userId !== actor.userId) throw notFound();
  return row;
}

export async function getUpscale(id: string, actor: Actor): Promise<Upscale> {
  const row = await ownedUpscale(id, actor);
  return row.status === 'processing' ? ((await advanceUpscale(id)) ?? row) : row;
}

// The owner's enlargements of one render or one views set, newest first.
export async function listUpscales(
  actor: Actor,
  filter: { renderId?: string; viewSetId?: string },
): Promise<Upscale[]> {
  if (!actor.userId) throw new AppError('Sign in to see your upscales', 401, 'sign_in');
  if (!filter.renderId && !filter.viewSetId)
    throw new AppError('Say which picture', 400, 'bad_request');
  const found = await db().upscale.findMany({
    where: { userId: actor.userId, renderId: filter.renderId, viewSetId: filter.viewSetId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  // An enlargement of a picture that has since been redrawn is of the old picture: left out.
  const current = new Map<string, string | null>();
  if (filter.viewSetId) {
    const views = await db().productView.findMany({ where: { setId: filter.viewSetId } });
    for (const view of views) current.set(`view:${view.view}`, view.key);
  } else if (filter.renderId) {
    const render = await db().render.findUnique({ where: { id: filter.renderId } });
    current.set('sheet:', render?.sheetKey ?? null);
  }
  const rows = found.filter(
    (row) => current.get(`${row.kind}:${row.view ?? ''}`) === row.sourceKey,
  );
  return Promise.all(
    rows.map((row) =>
      row.status === 'processing'
        ? advanceUpscale(row.id)
            .catch((error) => {
              reportError(error, { upscaleId: row.id, stage: 'upscale_list' });
              return row;
            })
            .then((next) => next ?? row)
        : row,
    ),
  );
}

export async function getUpscaleImage(
  id: string,
  actor: Actor,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const row = await ownedUpscale(id, actor);
  if (!row.key) throw notFound();
  const name = [row.kind, row.view].filter(Boolean).join('-');
  return {
    bytes: await getFile(row.key),
    filename: `easyrender-${name}-${row.width ?? 'large'}px.jpg`,
  };
}
