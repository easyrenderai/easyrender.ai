import {
  type Actor,
  assertActorScope,
  createDraft,
  createModelExport,
  getCreditQuote,
  getRender,
  MODEL_EXPORT_FORMATS,
  startBuild,
  toView,
} from '@easyrender/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerExtendedTools } from './extended-tools';
import { imageInputSchema, MAX_INLINE_IMAGE_BYTES, readImage } from './images';
import {
  forActor,
  idSchema,
  modelExportSchema,
  paidActor,
  quoteSchema,
  renderSchema,
  requireBudget,
  result,
} from './protocol';

export { MAX_INLINE_IMAGE_BYTES } from './images';

export function createMcpServer(actor: Actor) {
  actor = { ...actor, source: 'mcp' };
  const server = new McpServer(
    {
      name: 'easyrender',
      version: '0.2.0',
      title: 'Easy Render | Photo to 3D',
      websiteUrl: 'https://easyrender.ai/mcp',
      icons: [
        {
          src: 'https://easyrender.ai/apple-icon.png',
          mimeType: 'image/png',
          sizes: ['180x180'],
        },
        {
          src: 'https://easyrender.ai/icon.svg',
          mimeType: 'image/svg+xml',
          sizes: ['any'],
        },
      ],
    },
    { maxToolInputElements: 1000 },
  );
  server.registerTool(
    'create_render',
    {
      title: 'Create render preview',
      description: `Create a private preview from one product photo. Supply exactly one upload_id, image_url or image_base64. Upload larger local photos with authenticated POST /api/uploads (multipart image), then pass its id. Inline images: at most ${MAX_INLINE_IMAGE_BYTES} decoded bytes. URL/upload photos: up to 4 MiB. Reuse idempotency_key after a timeout. Poll get_render, inspect hasSheet, then approve pending_credits before render_3d.`,
      inputSchema: {
        ...imageInputSchema,
        prompt: z.string().max(500).optional(),
        name: z.string().max(120).optional(),
        idempotency_key: z.string().min(1).max(128).optional(),
        is_public: z.boolean().optional(),
      },
      outputSchema: renderSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    (input) =>
      forActor(actor, 'write', async () => {
        if (input.is_public) assertActorScope(actor, 'share');
        return result(
          await createDraft({
            actor,
            ...(await readImage(input, actor)),
            prompt: input.prompt,
            name: input.name,
            idempotencyKey: input.idempotency_key,
            isPublic: input.is_public ?? false,
            source: 'mcp',
          }),
        );
      }),
  );
  server.registerTool(
    'get_render',
    {
      title: 'Get render',
      description:
        'Read render status, artifact links and pending credits. Poll every 5–15 seconds. This may advance an already-authorized job; it does not authorize another paid generation. Private links need the same bearer authentication. Pass export_format (obj, fbx or blend) on a ready render you own to also get a signed download link in `export` (valid about 10 minutes; OBJ is a ZIP with its MTL and textures). The first export of a model converts it and can take up to a minute; exports are free and rate limited.',
      inputSchema: { id: idSchema, export_format: z.enum(MODEL_EXPORT_FORMATS).optional() },
      outputSchema: { ...renderSchema, export: modelExportSchema.optional() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ id, export_format }) =>
      forActor(actor, 'read', async (owner) => {
        const view = result(await getRender(id, actor));
        if (!export_format) return view;
        // Owner only, ready renders only: createModelExport answers 404 for anyone else's render.
        const file = await createModelExport(id, owner, export_format);
        return {
          ...view,
          export: {
            format: file.format,
            url: file.url,
            filename: file.filename,
            expires_at: file.expiresAt,
          },
        };
      }),
  );
  server.registerTool(
    'render_3d',
    {
      title: 'Render in 3D',
      description:
        'Build an approved preview for its pending_credits. Send max_credits as the authorized ceiling. Repeating the same running/ready render does not charge again. On timeout query the same id before retrying; never create another paid render automatically.',
      inputSchema: { id: idSchema, max_credits: z.number().int().nonnegative().optional() },
      outputSchema: renderSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    ({ id, max_credits }) =>
      forActor(actor, 'spend', async () => {
        const view = toView(await getRender(id, actor));
        requireBudget(
          max_credits,
          view.status === 'preview_ready' ? Math.max(0, view.renderCredits - view.credits) : 0,
        );
        return result(await startBuild(id, paidActor(actor, max_credits)));
      }),
  );
  server.registerTool(
    'get_credits',
    {
      title: 'Get credits',
      description:
        'Balance, current operation costs, buyer currency, public offers and actual account top-up rate. Prices are in currency; no purchase is made.',
      inputSchema: {},
      outputSchema: quoteSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    () => forActor(actor, 'read', (owner) => getCreditQuote(owner)),
  );
  registerExtendedTools(server, actor);
  return server;
}
