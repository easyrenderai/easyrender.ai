import { hash } from 'node:crypto';
import { db, type Prisma, type Render } from '@easyrender/db';
import {
  type Check,
  createReplicate,
  loadHarness,
  type Passed,
  ProviderRequestError,
} from '@easyrender/harness';
import { config } from './config';
import { AppError } from './errors';
import { reportError } from './report';
import type { ServiceEmailLocale } from './service-email-locale';

// Who is asking: a signed-in user, an anonymous visitor (cookie), or both.
export type Actor = {
  userId?: string | null;
  anonId?: string | null;
  ipHash?: string | null;
  geoCountry?: string | null;
  locale?: ServiceEmailLocale;
  apiKeyId?: string;
  apiKeyScopes?: string[];
  maxCredits?: number;
  isUsingFreeModel?: boolean;
  // Transport that creates the generation; credentials alone do not distinguish API from MCP.
  source?: RenderSource;
};

// The caller's explicit spend ceiling is checked again inside the debit transaction.
export function assertAuthorizedCredits(amount: number, actor: Actor) {
  if (actor.maxCredits === undefined) return;
  if (!Number.isSafeInteger(actor.maxCredits) || actor.maxCredits < 0) {
    throw new AppError('Credit limit must be a non-negative integer', 400, 'bad_max_credits');
  }
  if (amount > actor.maxCredits) {
    throw new AppError(
      'This operation exceeds the authorized credit limit',
      409,
      'budget_exceeded',
    );
  }
}

export type RenderSource = 'web' | 'mcp' | 'api';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_ACTIVE_RENDERS = 5;

export const harness = () => loadHarness({ token: config.harnessToken() });
export const replicate = () => createReplicate(config.replicateToken());
export const extension = (contentType: string) =>
  contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';

export function canAccess(render: Pick<Render, 'userId' | 'anonId'>, actor: Actor): boolean {
  if (render.userId) return render.userId === actor.userId;
  return Boolean(render.anonId && render.anonId === actor.anonId);
}

// Finished renders are in the public gallery unless their owner hid them.
export const isListed = (render: Pick<Render, 'isPublic' | 'status' | 'glbKey'>) =>
  render.isPublic && render.status === 'ready' && Boolean(render.glbKey);

// A store's product page embeds its models by link, so a finished link-shared render is viewable
// by anyone who has the link even though it is not in the gallery.
export const isShared = (render: Pick<Render, 'isLinkShared' | 'status' | 'glbKey'>) =>
  render.isLinkShared && render.status === 'ready' && Boolean(render.glbKey);

export const canView = (render: Render, actor: Actor) =>
  canAccess(render, actor) || isListed(render) || isShared(render);

// Turns a failed harness check into the API error the caller sees.
export function enforce<M>(check: Check<M>, status = 422): Passed<M> {
  if (!check.ok) throw new AppError(check.message, status, check.code);
  return check;
}

export async function lockRenderActor(tx: Prisma.TransactionClient, actor: Actor) {
  const identities = [
    actor.userId ? `user:${actor.userId}` : null,
    actor.anonId ? `anon:${actor.anonId}` : null,
    actor.ipHash ? `ip:${actor.ipHash}` : null,
  ]
    .filter((identity): identity is string => Boolean(identity))
    .sort();
  if (!identities.length) throw new AppError('Missing visitor id', 400, 'no_actor');
  for (const identity of identities) {
    const key = hash('sha256', `render-quota:${identity}`, 'buffer').readBigInt64BE();
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key})`;
  }
}

export async function assertGenerationConcurrency(actor: Actor, tx: Prisma.TransactionClient) {
  const owner = actor.userId
    ? { userId: actor.userId }
    : actor.anonId
      ? { anonId: actor.anonId }
      : { ipHash: actor.ipHash ?? '' };
  const [renders, viewSets, upscales] = await Promise.all([
    tx.render.count({ where: { ...owner, status: { in: ['drafting', 'rendering'] } } }),
    actor.userId
      ? tx.viewSet.count({
          where: { userId: actor.userId, status: { in: ['drafting', 'processing'] } },
        })
      : 0,
    actor.userId ? tx.upscale.count({ where: { userId: actor.userId, status: 'processing' } }) : 0,
  ]);
  if (renders + viewSets + upscales >= MAX_ACTIVE_RENDERS) {
    throw new AppError(
      'Too many active generations. Wait for one to finish.',
      429,
      'concurrent_limit',
    );
  }
}

// Fence a generation, while allowing unrelated visibility/metadata edits to coexist.
// In particular, drafting is reused by paid redraws and is not a unique generation identity.
export function renderStage(render: Render) {
  return {
    id: render.id,
    status: render.status,
    sheetRedraws: render.sheetRedraws,
    sheetPredictionId: render.sheetPredictionId,
    finalSheetPredictionId: render.finalSheetPredictionId,
    buildPredictionId: render.buildPredictionId,
    buildClaimedAt: render.buildClaimedAt,
  };
}

export async function persistStartedPrediction(
  render: Render,
  data: Prisma.RenderUpdateManyMutationInput,
) {
  try {
    await db().render.updateMany({ where: renderStage(render), data });
    return await db().render.findUniqueOrThrow({ where: { id: render.id } });
  } catch (error) {
    reportError(error, { renderId: render.id, stage: 'prediction_start_persistence' });
    // The provider accepted the job. A storage outage must not refund it or authorize a duplicate.
    throw new ProviderRequestError('Provider accepted the job but its id could not be saved', true);
  }
}

// What kind of provider failure this is, so a rejected request is told apart from an outage:
// `input` (4xx the provider will keep rejecting), `auth` (token or billing), `outage` (5xx) or
// `no_response` (no answer at all). Not a provider error: `other`.
function providerFailureKind(error: unknown): string {
  if (!(error instanceof ProviderRequestError)) return 'other';
  if (error.status === undefined) return 'no_response';
  if ([401, 402, 403].includes(error.status)) return 'auth';
  return error.status >= 500 ? 'outage' : 'input';
}

// A start whose outcome is unknown: no answer arrived (or the id could not be saved), so the job
// may exist and must not be replayed or refunded. An error response Replicate did send (even a
// 5xx) means it was rejected, so the render fails and refunds now instead of waiting for the
// never-started timeout.
export function isUncertainStart(error: unknown): error is ProviderRequestError {
  return error instanceof ProviderRequestError && error.isAmbiguous && error.status === undefined;
}

export function failureContext(error: unknown): Record<string, string> {
  return error instanceof ProviderRequestError
    ? { failureKind: providerFailureKind(error), providerStatus: String(error.status ?? 'none') }
    : {};
}
