import {
  type Actor,
  AppError,
  config,
  createRenderFromViews,
  createViewSet,
  getRender,
  getUpscale,
  getViewSet,
  listRenderPage,
  listUpscales,
  listViewSets,
  polishView,
  redrawSheet,
  setVisibility,
  startBuild,
  startSheet,
  startUpscale,
  toUpscaleView,
  toView,
  toViewSetView,
} from '@easyrender/core';
import {
  BUILD_FROM_VIEWS_CREDITS,
  PRODUCT_VIEWS_CREDITS,
  SHEET_CREDITS,
  UPSCALE_CREDITS,
  VIEW_POLISH_CREDITS,
} from '@easyrender/harness';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { imageInputSchema, readImage } from './images';
import { forActor, idSchema, paidActor, renderSchema, requireBudget, result } from './protocol';

const budgetSchema = z
  .number()
  .int()
  .nonnegative()
  .describe('Maximum credits explicitly authorized for this action');
const modifies = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};
const reads = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};
const upscaleSchema = {
  id: idSchema,
  kind: z.enum(['view', 'sheet']),
  renderId: z.string().nullable(),
  viewSetId: z.string().nullable(),
  view: z.string().nullable(),
  status: z.enum(['processing', 'ready', 'failed']),
  hasImage: z.boolean(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  credits: z.number(),
  createdAt: z.string(),
  links: z.object({ image: z.string().url() }),
};
const viewSetSchema = {
  id: idSchema,
  name: z.string().nullable(),
  prompt: z.string().nullable(),
  status: z.enum(['drafting', 'processing', 'ready', 'failed']),
  error: z.string().nullable(),
  views: z.array(
    z.object({
      view: z.string(),
      status: z.string(),
      hasImage: z.boolean(),
      version: z.number(),
      isFlagged: z.boolean(),
      problems: z.array(z.unknown()),
      isPolishing: z.boolean(),
      note: z.string().nullable(),
    }),
  ),
  readyCount: z.number(),
  viewCount: z.number(),
  credits: z.number(),
  polishCredits: z.number(),
  upscaleCredits: z.number(),
  buildCredits: z.number(),
  renderId: z.string().nullable(),
  createdAt: z.string(),
  links: z.object({ zip: z.string().url() }),
};
function upscaleResult(row: Parameters<typeof toUpscaleView>[0]) {
  const view = toUpscaleView(row);
  if (!view) throw new AppError('Unsupported upscale result', 500, 'internal');
  return { ...view, links: { image: `${config.appUrl()}/api/upscales/${view.id}/image` } };
}
function viewSetResult(row: Parameters<typeof toViewSetView>[0]) {
  const view = toViewSetView(row);
  return { ...view, links: { zip: `${config.appUrl()}/api/product-views/${view.id}/zip` } };
}

export function registerExtendedTools(server: McpServer, actor: Actor & { userId: string }) {
  server.registerTool(
    'list_renders',
    {
      title: 'List your renders',
      description:
        'Find and recover your renders, newest first. Follow next_cursor to retrieve more. Only this account’s renders are listed.',
      inputSchema: {
        cursor: z.string().min(1).max(512).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        status: renderSchema.status.optional(),
      },
      outputSchema: {
        renders: z.array(z.object(renderSchema)),
        next_cursor: z.string().nullable(),
      },
      annotations: { ...reads, readOnlyHint: true },
    },
    (input) =>
      forActor(actor, 'read', async () => {
        const page = await listRenderPage(actor.userId, input);
        return { renders: page.renders.map(result), next_cursor: page.nextCursor };
      }),
  );
  server.registerTool(
    'set_render_visibility',
    {
      title: 'Set render visibility',
      description:
        'Explicitly publish a finished model in the public gallery or make it private. Requires share permission; publishing exposes the render to other people.',
      inputSchema: { id: idSchema, is_public: z.boolean() },
      outputSchema: renderSchema,
      annotations: { ...modifies, idempotentHint: true, openWorldHint: false },
    },
    ({ id, is_public }) =>
      forActor(actor, 'share', async () => result(await setVisibility(id, actor, is_public))),
  );
  server.registerTool(
    'start_render_sheet',
    {
      title: 'Generate an angle sheet',
      description:
        'Generate a paid angle sheet for a preview without one. Existing sheets/jobs are reused. The sheet cost counts toward the later 3D build. Query get_credits.sheet_credits first.',
      inputSchema: { id: idSchema, max_credits: budgetSchema },
      outputSchema: renderSchema,
      annotations: { ...modifies, idempotentHint: true },
    },
    ({ id, max_credits }) =>
      forActor(actor, 'spend', async () => {
        const render = await getRender(id, actor);
        requireBudget(max_credits, render.sheetKey || render.sheetPredictionId ? 0 : SHEET_CREDITS);
        return result(await startSheet(id, paidActor(actor, max_credits)));
      }),
  );
  server.registerTool(
    'redraw_render_sheet',
    {
      title: 'Redraw an angle sheet',
      description:
        'Pay to redraw a preview sheet using a correction note. Each completed redraw is a new charge and does not count toward the 3D cost. On timeout inspect the same render before deciding whether to repeat.',
      inputSchema: {
        id: idSchema,
        note: z.string().trim().min(1).max(500),
        max_credits: budgetSchema,
      },
      outputSchema: renderSchema,
      annotations: modifies,
    },
    ({ id, note, max_credits }) =>
      forActor(actor, 'spend', async () => {
        requireBudget(max_credits, SHEET_CREDITS);
        return result(await redrawSheet(id, paidActor(actor, max_credits), note));
      }),
  );
  server.registerTool(
    'upscale_image',
    {
      title: 'Upscale a paid image',
      description:
        'Enlarge an owned product view or the sheet of a paid render. Quote upscale_credits with get_credits. Existing enlargements may be reused; query get_upscale to track the result, or list_upscales to recover its id. Do not repeat an uncertain request automatically.',
      inputSchema: {
        kind: z.enum(['sheet', 'view']),
        render_id: idSchema.optional(),
        view_set_id: idSchema.optional(),
        view: z.string().min(1).max(100).optional(),
        max_credits: budgetSchema,
      },
      outputSchema: upscaleSchema,
      annotations: modifies,
    },
    ({ kind, render_id, view_set_id, view, max_credits }) =>
      forActor(actor, 'spend', async () => {
        requireBudget(max_credits, UPSCALE_CREDITS);
        if (kind === 'sheet') {
          if (!render_id || view_set_id || view)
            throw new AppError('For a sheet, supply only render_id', 400, 'bad_request');
          return upscaleResult(
            await startUpscale({ kind, renderId: render_id }, paidActor(actor, max_credits)),
          );
        }
        if (!view_set_id || !view || render_id)
          throw new AppError('For a view, supply view_set_id and view', 400, 'bad_request');
        return upscaleResult(
          await startUpscale({ kind, viewSetId: view_set_id, view }, paidActor(actor, max_credits)),
        );
      }),
  );
  server.registerTool(
    'get_upscale',
    {
      title: 'Get an upscale',
      description:
        'Read your enlargement’s status and authenticated image URL. Poll every 5–15 seconds until ready or failed.',
      inputSchema: { id: idSchema },
      outputSchema: upscaleSchema,
      annotations: reads,
    },
    ({ id }) => forActor(actor, 'read', async () => upscaleResult(await getUpscale(id, actor))),
  );
  server.registerTool(
    'create_product_views',
    {
      title: 'Create product views',
      description:
        'Buy nine product photos from one source photo. This is a paid operation, separate from the free 3D preview. Query product_views_credits with get_credits and obtain authorization. On timeout recover the existing set using list_product_views before retrying.',
      inputSchema: {
        ...imageInputSchema,
        prompt: z.string().max(500).optional(),
        name: z.string().max(120).optional(),
        max_credits: budgetSchema,
      },
      outputSchema: viewSetSchema,
      annotations: modifies,
    },
    (input) =>
      forActor(actor, 'spend', async () => {
        requireBudget(input.max_credits, PRODUCT_VIEWS_CREDITS);
        return viewSetResult(
          await createViewSet({
            actor: paidActor(actor, input.max_credits),
            ...(await readImage(input, actor)),
            prompt: input.prompt,
            name: input.name,
          }),
        );
      }),
  );
  server.registerTool(
    'get_product_views',
    {
      title: 'Get product views',
      description:
        'Read your product-view set’s state, quality flags, follow-up costs and authenticated ZIP URL. Poll until ready or failed.',
      inputSchema: { id: idSchema },
      outputSchema: viewSetSchema,
      annotations: reads,
    },
    ({ id }) => forActor(actor, 'read', async () => viewSetResult(await getViewSet(id, actor))),
  );
  server.registerTool(
    'list_product_views',
    {
      title: 'List recent product views',
      description:
        'Recover your latest product-view sets, newest first. Returns at most limit entries (default 24, maximum 100); this is a bounded recent list, without pagination.',
      inputSchema: { limit: z.number().int().min(1).max(100).optional() },
      outputSchema: { view_sets: z.array(z.object(viewSetSchema)) },
      annotations: reads,
    },
    ({ limit }) =>
      forActor(actor, 'read', async () => ({
        view_sets: (await listViewSets(actor.userId, limit ?? 24)).map(viewSetResult),
      })),
  );
  server.registerTool(
    'list_upscales',
    {
      title: 'List picture enlargements',
      description:
        'Recover up to 50 of your current enlargements for one render or product-view set, newest first. Supply exactly one render_id or view_set_id. Replaced source images are excluded.',
      inputSchema: { render_id: idSchema.optional(), view_set_id: idSchema.optional() },
      outputSchema: { upscales: z.array(z.object(upscaleSchema)) },
      annotations: reads,
    },
    ({ render_id, view_set_id }) =>
      forActor(actor, 'read', async () => {
        if (Number(Boolean(render_id)) + Number(Boolean(view_set_id)) !== 1)
          throw new AppError('Supply exactly one render_id or view_set_id', 400, 'bad_request');
        return {
          upscales: (
            await listUpscales(actor, { renderId: render_id, viewSetId: view_set_id })
          ).map(upscaleResult),
        };
      }),
  );
  server.registerTool(
    'polish_product_view',
    {
      title: 'Polish a product view',
      description:
        'Pay to correct one ready product photo using a note. Quote view_polish_credits first. Check get_product_views after a timeout; repeating a completed polish incurs a new charge.',
      inputSchema: {
        id: idSchema,
        view: z.string().min(1).max(100),
        note: z.string().trim().min(1).max(500),
        max_credits: budgetSchema,
      },
      outputSchema: viewSetSchema,
      annotations: modifies,
    },
    ({ id, view, note, max_credits }) =>
      forActor(actor, 'spend', async () => {
        requireBudget(max_credits, VIEW_POLISH_CREDITS);
        return viewSetResult(await polishView(id, view, paidActor(actor, max_credits), note));
      }),
  );
  server.registerTool(
    'build_from_product_views',
    {
      title: 'Build 3D from product views',
      description:
        'Build a GLB from a completed product-view set, reusing its paid sheet. Quote build_from_views_credits first. Existing running/ready builds are reused. On timeout recover renderId through get_product_views.',
      inputSchema: { id: idSchema, max_credits: budgetSchema },
      outputSchema: renderSchema,
      annotations: { ...modifies, idempotentHint: true },
    },
    ({ id, max_credits }) =>
      forActor(actor, 'spend', async () => {
        const set = await getViewSet(id, actor);
        // Check the cap before creating even the unpaid render record.
        let pending = BUILD_FROM_VIEWS_CREDITS;
        if (set.renderId) {
          const view = toView(await getRender(set.renderId, actor));
          pending =
            view.status === 'preview_ready' ? Math.max(0, view.renderCredits - view.credits) : 0;
        }
        requireBudget(max_credits, pending);
        const renderId = await createRenderFromViews(id, actor);
        const view = toView(await getRender(renderId, actor));
        requireBudget(
          max_credits,
          view.status === 'preview_ready' ? Math.max(0, view.renderCredits - view.credits) : 0,
        );
        return result(await startBuild(renderId, paidActor(actor, max_credits)));
      }),
  );
}
