import {
  type Actor,
  ApiRateLimitError,
  AppError,
  assertActorScope,
  config,
  isRetryable,
  reportError,
  toView,
} from '@easyrender/core';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
export const qualitySchema = z.enum(['low', 'medium', 'high']);
export const idSchema = z.string().min(1).max(200);
export const renderSchema = {
  id: idSchema,
  status: z.enum(['drafting', 'preview_ready', 'rendering', 'ready', 'failed']),
  prompt: z.string().nullable(),
  name: z.string().nullable(),
  error: z.string().nullable(),
  hasPreview: z.boolean(),
  hasSheet: z.boolean(),
  sheetNote: z.string().nullable(),
  hasModel: z.boolean(),
  modelVersion: z.number(),
  credits: z.number().nonnegative(),
  renderCredits: z.number().nonnegative(),
  qualityCredits: z.object({
    low: z.number().nonnegative(),
    medium: z.number().nonnegative(),
    high: z.number().nonnegative(),
  }),
  buildQuality: z.enum(['low', 'medium', 'high']),
  rebuildRefundCredits: z.number().nonnegative(),
  sheetCredits: z.number().nonnegative(),
  upscaleCredits: z.number().nonnegative(),
  canUpscale: z.boolean(),
  isPublic: z.boolean(),
  source: z.enum(['web', 'mcp', 'api']),
  createdAt: z.string(),
  pending_credits: z.number().nonnegative(),
  links: z.object({
    page: z.string().url().optional(),
    preview: z.string().url(),
    model_glb: z.string().url(),
  }),
};
export const modelExportSchema = z.object({
  format: z.enum(['obj', 'fbx', 'blend']),
  url: z.string().url(),
  filename: z.string(),
  expires_at: z.string(),
});
// `usd_per_*` are legacy aliases that getCreditQuote adds for USD buyers. The output schema is
// strict, so a field it does not list makes the client reject the whole result.
const planSchema = z.object({
  price_per_month: z.number(),
  usd_per_month: z.number().optional(),
  credits_per_month: z.number(),
});
export const quoteSchema = {
  pricing_variant: z.enum(['control', 'test']),
  currency: z.enum(['usd', 'eur']),
  balance: z.number(),
  render_credits: z.number(),
  render_credits_by_quality: z.object({ low: z.number(), medium: z.number(), high: z.number() }),
  sheet_credits: z.number(),
  product_views_credits: z.number(),
  view_polish_credits: z.number(),
  upscale_credits: z.number(),
  build_from_views_credits: z.number(),
  plans: z.object({
    pay_as_you_go: z.object({
      price_per_credit: z.number(),
      usd_per_credit: z.number().optional(),
      min_credits: z.number(),
      max_credits: z.number(),
    }),
    pro: planSchema,
    enterprise: z.object({ book_a_call: z.string().url() }),
  }),
  topup: z.object({
    plan: z.string().nullable(),
    currency: z.enum(['usd', 'eur']),
    price_cents: z.number(),
    credits_per_unit: z.number(),
  }),
  buy: z.string().url(),
};

export function toolError(error: unknown): CallToolResult {
  const isKnown = error instanceof AppError;
  if (!isKnown) reportError(error, { stage: 'mcp-tool' });
  const details = {
    code: isKnown ? error.code : 'internal',
    message: isKnown
      ? error.message
      : 'Unexpected error. Check the render status before retrying a mutation.',
    status: isKnown ? error.status : 500,
    ...(error instanceof ApiRateLimitError ? { retry_after_seconds: error.retryAfter } : {}),
    retryable: isRetryable(error),
  };
  const data = { error: details };
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data,
    isError: true,
  };
}
export async function run(fn: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
  } catch (error) {
    return toolError(error);
  }
}
export function result(render: Parameters<typeof toView>[0]) {
  const view = toView(render);
  const base = config.appUrl();
  return {
    ...view,
    pending_credits:
      view.status === 'preview_ready' ? Math.max(0, view.renderCredits - view.credits) : 0,
    links: {
      ...(view.isPublic ? { page: `${base}/r/${view.id}` } : {}),
      preview: `${base}/api/renders/${view.id}/preview`,
      model_glb: `${base}/api/renders/${view.id}/model`,
    },
  };
}

export const MCP_UNAUTHORIZED_MESSAGE =
  'Pass an easyrender API key as Authorization: Bearer er_...';

export function forActor(
  actor: Actor,
  scope: 'read' | 'write' | 'spend' | 'share',
  fn: (owner: Actor & { userId: string }) => Promise<Record<string, unknown>>,
) {
  return run(async () => {
    if (!actor.userId) throw new AppError(MCP_UNAUTHORIZED_MESSAGE, 401, 'unauthorized');
    assertActorScope(actor, scope);
    return fn({ ...actor, userId: actor.userId });
  });
}
// What starting a build at `quality` still costs: its total minus what the render already paid.
export function pendingCredits(
  view: ReturnType<typeof toView>,
  quality: z.infer<typeof qualitySchema> = 'low',
) {
  return view.status === 'preview_ready'
    ? Math.max(0, view.qualityCredits[quality] - view.credits)
    : 0;
}

export function requireBudget(maxCredits: number | undefined, cost: number) {
  if (maxCredits !== undefined && cost > maxCredits)
    throw new AppError(
      'This action exceeds max_credits. Request a new authorized budget before proceeding.',
      409,
      'budget_exceeded',
    );
}

export function paidActor(actor: Actor, maxCredits: number | undefined) {
  return { ...actor, maxCredits };
}
