import {
  type Actor,
  AppError,
  config,
  createDraft,
  fetchRemoteImage,
  getCreditQuote,
  getRender,
  reportError,
  startBuild,
  toView,
} from '@easyrender/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// The HTTP transport accepts 4 MiB including JSON, base64 and notes. Leave room for the envelope;
// larger photos (up to the core 4 MiB limit) use a public URL or the authenticated upload endpoint.
export const MAX_INLINE_IMAGE_BYTES = 3 * 1024 * 1024 - 16 * 1024;
const MAX_INLINE_BASE64_CHARS = 4 * Math.ceil(MAX_INLINE_IMAGE_BYTES / 3);
const idSchema = z.string().min(1).max(200);
const renderSchema = {
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
  sheetCredits: z.number().nonnegative(),
  upscaleCredits: z.number().nonnegative(),
  canUpscale: z.boolean(),
  isPublic: z.boolean(),
  source: z.enum(['web', 'mcp', 'api']),
  createdAt: z.string(),
  pending_credits: z.number().nonnegative(),
  links: z.object({
    page: z.string().url(),
    preview: z.string().url(),
    model_glb: z.string().url(),
  }),
};
const planSchema = z.object({ price_per_month: z.number(), credits_per_month: z.number() });
const quoteSchema = {
  pricing_variant: z.enum(['control', 'test']),
  currency: z.enum(['usd', 'eur']),
  balance: z.number(),
  render_credits: z.number(),
  plans: z.object({
    pay_as_you_go: z.object({
      price_per_credit: z.number(),
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
    retryable: isKnown && [429, 502, 503, 504].includes(error.status),
  };
  const data = { error: details };
  return {
    content: [{ type: 'text', text: JSON.stringify(data) }],
    structuredContent: data,
    isError: true,
  };
}
async function run(fn: () => Promise<Record<string, unknown>>): Promise<CallToolResult> {
  try {
    const data = await fn();
    return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
  } catch (error) {
    return toolError(error);
  }
}
function result(render: Parameters<typeof toView>[0]) {
  const view = toView(render);
  const base = config.appUrl();
  return {
    ...view,
    pending_credits:
      view.status === 'preview_ready' ? Math.max(0, view.renderCredits - view.credits) : 0,
    links: {
      page: `${base}/r/${view.id}`,
      preview: `${base}/api/renders/${view.id}/preview`,
      model_glb: `${base}/api/renders/${view.id}/model`,
    },
  };
}

export function createMcpServer(actor: Actor & { userId: string }) {
  const server = new McpServer(
    { name: 'easyrender', version: '0.2.0' },
    { maxToolInputElements: 1000 },
  );
  server.registerTool(
    'create_render',
    {
      title: 'Create render preview',
      description:
        'Create a preview from one product photo. Supply exactly one image_url or image_base64. Inline photos must be at most ' +
        MAX_INLINE_IMAGE_BYTES +
        ' decoded bytes; URL photos may be up to 4 MiB. Poll get_render, inspect hasSheet, and approve the pending cost before render_3d. Asset links require the same authentication for private renders.',
      inputSchema: {
        image_url: z
          .string()
          .url()
          .max(4096)
          .optional()
          .describe('Public HTTPS JPEG, PNG or WebP URL'),
        image_base64: z
          .string()
          .max(MAX_INLINE_BASE64_CHARS)
          .optional()
          .describe('Canonical base64 without a data URL prefix; requires content_type'),
        content_type: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
        prompt: z.string().max(500).optional(),
      },
      outputSchema: renderSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    ({ image_url, image_base64, content_type, prompt }) =>
      run(async () => {
        if (Number(Boolean(image_url)) + Number(Boolean(image_base64)) !== 1)
          throw new AppError(
            'Supply exactly one image_url or image_base64',
            400,
            'invalid_image_input',
          );
        if (image_url && content_type)
          throw new AppError(
            'content_type is only used with image_base64',
            400,
            'invalid_image_input',
          );
        let image: { bytes: Uint8Array; contentType: string };
        if (image_url) image = await fetchRemoteImage(image_url);
        else {
          if (
            !content_type ||
            !image_base64 ||
            !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image_base64)
          )
            throw new AppError(
              'Supply canonical base64 and its content_type',
              400,
              'invalid_image_input',
            );
          const bytes = Buffer.from(image_base64, 'base64');
          if (bytes.toString('base64') !== image_base64)
            throw new AppError('Invalid base64 encoding', 400, 'invalid_image_input');
          if (bytes.byteLength > MAX_INLINE_IMAGE_BYTES)
            throw new AppError(
              'Inline photo is too large; use an uploaded image or image_url',
              413,
              'too_large',
            );
          image = { bytes: new Uint8Array(bytes), contentType: content_type };
        }
        return result(await createDraft({ actor, prompt, source: 'mcp', ...image }));
      }),
  );
  server.registerTool(
    'get_render',
    {
      title: 'Get render',
      description:
        'Read render status and pending credits. Poll every 5–15 seconds. This may advance an already-authorized job; it never authorizes a new paid generation.',
      inputSchema: { id: idSchema },
      outputSchema: renderSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ id }) => run(async () => result(await getRender(id, actor))),
  );
  server.registerTool(
    'render_3d',
    {
      title: 'Render in 3D',
      description:
        'Spend the pending_credits shown by get_render to build an approved preview. Respect the user’s authorized budget. Repeating this call for the same running or ready render does not charge again. On a timeout, query that render before retrying.',
      inputSchema: { id: idSchema },
      outputSchema: renderSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ id }) => run(async () => result(await startBuild(id, actor))),
  );
  server.registerTool(
    'get_credits',
    {
      title: 'Get credits',
      description:
        'Current balance, buyer currency, public offers and the account’s actual credit top-up rate. Prices are in currency; no purchase is made.',
      inputSchema: {},
      outputSchema: quoteSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    () => run(() => getCreditQuote(actor)),
  );
  return server;
}
