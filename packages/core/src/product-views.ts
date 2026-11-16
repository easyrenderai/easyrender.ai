import { randomUUID } from 'node:crypto';
import { db, type Prisma, type ProductView, type ViewSet } from '@easyrender/db';
import {
  BUILD_FROM_VIEWS_CREDITS,
  betterView,
  checkNote,
  checkPhoto,
  checkSheet,
  checkView,
  cleanNote,
  composeSheet,
  createReplicate,
  cutCells,
  DEFAULT_FINAL_SHEET_SETTINGS,
  DEFAULT_SHEET_SETTINGS,
  download,
  ENLARGE_MODEL,
  enlargeRequest,
  FINAL_SHEET_MODEL,
  finishView,
  imageSide,
  isSettled,
  isViewId,
  loadHarness,
  measureObject,
  needsUpscale,
  PRODUCT_VIEWS_CREDITS,
  ProviderRequestError,
  SHEET_MODEL,
  selectMaterialsFrom,
  selectSkillFrom,
  sheetOutputUrl,
  sheetRequest,
  UPSCALE_CREDITS,
  VIEW_POLISH_CREDITS,
  VIEWS,
  type ViewId,
  type ViewProblem,
  viewPrompt,
  viewRequest,
} from '@easyrender/harness';
import { config } from './config';
import { grantCreditsInTransaction, spendCreditsInTransaction } from './credits';
import { AppError, notFound } from './errors';
import {
  type Actor,
  assertAuthorizedCredits,
  assertGenerationConcurrency,
  extension,
  IMAGE_TYPES,
  lockRenderActor,
  MAX_UPLOAD_BYTES,
} from './renders';
import { reportError } from './report';
import { getFile, putFile } from './storage';
import { advanceUpscale } from './upscale';
import { zipStore } from './zip';

// Product views: one photo in, nine packshots out on white, for someone who needs the pictures
// and not the 3D model. The set is paid when it is created. A 2K sheet is drawn and cut into
// views; each view is checked on its own, drawn again once if it fails, upscaled and finished on
// a fixed white canvas. The owner can then polish any single view with a note, and can build the
// 3D model from the finished views.
//
// A view never fails the set: whatever goes wrong after the sheet (a redraw, an upscale), the view
// falls back to the best picture it has and is flagged for the owner to look at. Only a sheet that
// cannot be drawn fails the set, and that refunds it in full.

// A sheet takes about a minute; anything still running after this has been lost.
const SET_STALE_MS = 45 * 60 * 1000;
// A redraw or an upscale takes seconds to a minute.
const VIEW_STALE_MS = 10 * 60 * 1000;
const MAX_SHEET_ATTEMPTS = 2;
class TerminalViewSetError extends Error {}

const harness = () => loadHarness({ token: config.harnessToken() });
const replicate = () => createReplicate(config.replicateToken());
const webhook = (id: string) => config.webhookUrl(`/api/webhooks/replicate?views=${id}`);

export type ViewSetWithViews = ViewSet & { views: ProductView[] };

type StoredQa = { problems: ViewProblem[]; sharpness: number };
const storedQa = (view: Pick<ProductView, 'qa'>): StoredQa => {
  const value = view.qa;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const qa = value as Partial<StoredQa>;
    return { problems: qa.problems ?? [], sharpness: qa.sharpness ?? 0 };
  }
  return { problems: [], sharpness: 0 };
};

const contentTypeOf = (key: string) =>
  key.endsWith('.png') ? 'image/png' : key.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

// Every asynchronous worker writes only the exact revision it read. The timestamp advances
// monotonically, including two transitions that happen within the same millisecond.
const viewSnapshot = (view: ProductView) => ({
  id: view.id,
  status: view.status,
  predictionId: view.predictionId,
  updatedAt: view.updatedAt,
  polishes: view.polishes,
  attempts: view.attempts,
  version: view.version,
});
async function transitionView(
  view: ProductView,
  data: Prisma.ProductViewUpdateManyMutationInput,
  costUsd = 0,
): Promise<ProductView | null> {
  return db().$transaction(async (tx) => {
    const { count } = await tx.productView.updateMany({
      where: viewSnapshot(view),
      data: { ...data, updatedAt: new Date(Math.max(Date.now(), view.updatedAt.getTime() + 1)) },
    });
    if (!count) return null;
    if (costUsd)
      await tx.viewSet.update({
        where: { id: view.setId },
        data: { costUsd: { increment: costUsd } },
      });
    return tx.productView.findUniqueOrThrow({ where: { id: view.id } });
  });
}

const owns = (set: Pick<ViewSet, 'userId'>, actor: Actor) =>
  Boolean(actor.userId) && set.userId === actor.userId;

async function loadSet(id: string): Promise<ViewSetWithViews | null> {
  return db().viewSet.findUnique({ where: { id }, include: { views: true } });
}

async function ownedSet(id: string, actor: Actor): Promise<ViewSetWithViews> {
  if (!actor.userId) throw new AppError('Sign in to see your product views', 401, 'sign_in');
  const set = await loadSet(id);
  if (!set || !owns(set, actor)) throw notFound();
  return set;
}

// Draws the sheet from the stored photo and records the prediction.
async function startSheet(set: ViewSet): Promise<void> {
  const client = replicate();
  const bytes = await getFile(set.sourceKey);
  const contentType = contentTypeOf(set.sourceKey);
  const sourceUrl = await client.upload(bytes, `source.${extension(contentType)}`, contentType);
  const recipe = await harness();
  const request = sheetRequest(
    sourceUrl,
    set.prompt,
    selectSkillFrom(recipe.skills, set.name, set.prompt),
    DEFAULT_FINAL_SHEET_SETTINGS,
    recipe.sheetPrompt,
    selectMaterialsFrom(recipe.materials, set.name, set.prompt),
  );
  const prediction = await client.start(request.path, request.body, webhook(set.id));
  try {
    await db().viewSet.updateMany({
      where: {
        id: set.id,
        status: 'drafting',
        sheetPredictionId: set.sheetPredictionId,
        updatedAt: set.updatedAt,
      },
      data: { sourceUrl, sheetPredictionId: prediction.id },
    });
  } catch (error) {
    reportError(error, { viewSetId: set.id, stage: 'sheet_start_persistence' });
    throw new ProviderRequestError(
      'Provider accepted the sheet but its id could not be saved',
      true,
    );
  }
}

// A set that cannot get a sheet is refunded in full. Once the sheet exists nothing fails the set.
async function failSet(id: string, error: unknown, expected?: Pick<ViewSet, 'updatedAt'>) {
  const message = error instanceof Error ? error.message : String(error);
  reportError(error, { viewSetId: id, stage: 'product_views' });
  const set = await db().viewSet.findUnique({ where: { id } });
  if (!set) return;
  await db().$transaction(async (tx) => {
    const { count } = await tx.viewSet.updateMany({
      where: { id, status: 'drafting', updatedAt: expected?.updatedAt ?? set.updatedAt },
      data: { status: 'failed', error: message.slice(0, 500) },
    });
    if (!count) return;
    await grantCreditsInTransaction(tx, {
      userId: set.userId,
      amount: set.credits,
      key: `refund:views:${id}`,
      reason: 'product_views_failed',
    });
  });
}

// Takes the photo, charges the set and starts drawing its sheet.
export async function createViewSet(input: {
  actor: Actor;
  bytes: Uint8Array;
  contentType: string;
  prompt?: string | null;
  name?: string | null;
}): Promise<ViewSetWithViews> {
  const { actor } = input;
  if (!actor.userId) throw new AppError('Sign in to make product views', 401, 'sign_in');
  if (!IMAGE_TYPES.has(input.contentType)) {
    throw new AppError('Upload a JPEG, PNG or WebP photo', 415, 'bad_type');
  }
  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError('Photo is larger than 4 MB', 413, 'too_large');
  }
  // A bad photo or note is refused before it costs credits or a generation.
  const photo = await checkPhoto(input.bytes);
  if (!photo.ok) throw new AppError(photo.message, 422, photo.code);
  const note = checkNote(input.prompt);
  if (!note.ok) throw new AppError(note.message, 400, note.code);

  const id = randomUUID();
  const sourceKey = await putFile(
    `sources/source.${extension(input.contentType)}`,
    input.bytes,
    input.contentType,
  );
  const set = await db().$transaction(async (tx) => {
    await lockRenderActor(tx, actor);
    assertAuthorizedCredits(PRODUCT_VIEWS_CREDITS, actor);
    await assertGenerationConcurrency(actor, tx);
    const set = await tx.viewSet.create({
      data: {
        id,
        userId: actor.userId as string,
        name: input.name?.trim().slice(0, 120) || null,
        prompt: cleanNote(input.prompt) || null,
        sourceKey,
        credits: PRODUCT_VIEWS_CREDITS,
        quality: { photo: { ...photo.measures, warnings: photo.warnings } },
      },
    });
    await spendCreditsInTransaction(tx, {
      apiKeyId: actor.apiKeyId,
      userId: actor.userId as string,
      amount: PRODUCT_VIEWS_CREDITS,
      key: `views:${id}`,
      reason: 'product_views',
    });
    return set;
  });
  try {
    await startSheet(set);
  } catch (error) {
    if (error instanceof ProviderRequestError && error.isAmbiguous)
      return (await loadSet(id)) as ViewSetWithViews;
    await failSet(id, error);
    throw new AppError(
      'Could not start your product views. Your credits were refunded.',
      502,
      'upstream',
    );
  }
  return (await loadSet(id)) as ViewSetWithViews;
}

// --- Moving a set forward ------------------------------------------------------------------

// Called by polling and by the Replicate webhook. It always re-reads predictions from Replicate,
// so it is safe to call with any input, and every step is claimed so two callers cannot both run it.
export async function advanceViewSet(id: string): Promise<ViewSetWithViews | null> {
  const set = await loadSet(id);
  if (!set) return null;
  try {
    if (set.status === 'drafting') await advanceSheet(set);
    else if (set.status === 'processing') await advanceViews(set);
  } catch (error) {
    if (
      set.status === 'drafting' &&
      (error instanceof TerminalViewSetError || Date.now() - set.updatedAt.getTime() > SET_STALE_MS)
    )
      await failSet(id, error, set);
    else reportError(error, { viewSetId: id, stage: 'product_views' });
  }
  return loadSet(id);
}

async function advanceSheet(set: ViewSetWithViews) {
  const stale = Date.now() - set.updatedAt.getTime() > SET_STALE_MS;
  if (!set.sheetPredictionId) {
    if (stale) throw new TerminalViewSetError('never started');
    return;
  }
  const prediction = await replicate().get(set.sheetPredictionId);
  if (!isSettled(prediction.status)) {
    if (stale) throw new TerminalViewSetError('angle sheet timed out');
    return;
  }
  const recipe = await harness();

  let sheet: Uint8Array | null = null;
  let measures: Awaited<ReturnType<typeof checkSheet>> | null = null;
  let problem = prediction.error ?? `sheet ${prediction.status}`;
  if (prediction.status === 'succeeded') {
    const url = sheetOutputUrl(prediction.output);
    if (url) {
      const bytes = await download(url);
      measures = await checkSheet(bytes, recipe.limits);
      if (measures.ok) sheet = bytes;
      else problem = `sheet rejected (${measures.code}): ${measures.message}`;
    }
  }

  if (!sheet || !measures?.ok) {
    // One automatic redraw of the whole sheet before the set is given up on.
    if (set.sheetAttempts < MAX_SHEET_ATTEMPTS) {
      const { count } = await db().viewSet.updateMany({
        where: {
          id: set.id,
          status: 'drafting',
          sheetPredictionId: set.sheetPredictionId,
          updatedAt: set.updatedAt,
        },
        data: {
          sheetPredictionId: null,
          sheetAttempts: { increment: 1 },
          ...(prediction.status === 'succeeded'
            ? { costUsd: { increment: FINAL_SHEET_MODEL.costUsd } }
            : {}),
        },
      });
      if (count === 1)
        await startSheet(await db().viewSet.findUniqueOrThrow({ where: { id: set.id } }));
      return;
    }
    throw new TerminalViewSetError(problem);
  }

  const sheetKey = await putFile('views/sheet.png', sheet, 'image/png');
  const { count } = await db().viewSet.updateMany({
    where: {
      id: set.id,
      status: 'drafting',
      sheetPredictionId: set.sheetPredictionId,
      updatedAt: set.updatedAt,
    },
    data: {
      status: 'processing',
      sheetKey,
      costUsd: { increment: FINAL_SHEET_MODEL.costUsd },
      quality: {
        ...(typeof set.quality === 'object' && set.quality && !Array.isArray(set.quality)
          ? set.quality
          : {}),
        sheet: { ...measures.measures, warnings: measures.warnings },
        sheetAttempts: set.sheetAttempts,
      },
    },
  });
  // Another call won the claim and is cutting the views.
  if (count === 0) return;

  await seedViews((await loadSet(set.id)) as ViewSetWithViews, sheet);
}

// Cuts the sheet into views and starts each one: a view that passes its checks goes to the
// upscaler, one that fails is drawn again on its own. Only the views that do not exist yet are
// made, so a worker that died halfway can be picked up again.
async function seedViews(set: ViewSetWithViews, sheet: Uint8Array) {
  const limits = (await harness()).limits;
  const have = new Set(set.views.map((view) => view.view));
  const source = await measureObject(await getFile(set.sourceKey));
  const cells = await cutCells(sheet);
  const rows: ProductView[] = [];
  for (const [index, cell] of cells.entries()) {
    const view = VIEWS[index] as ViewId;
    if (have.has(view)) continue;
    const check = await checkView(cell, source, limits);
    const rawKey = await putFile('views/raw.png', cell, 'image/png');
    const isRetried = !check.ok && limits.viewMaxRetries > 0;
    rows.push(
      await db().productView.create({
        data: {
          setId: set.id,
          view,
          rawKey,
          status: isRetried ? 'drawing' : 'upscaling',
          attempts: isRetried ? 1 : 0,
          qa: { ...check.measures, problems: check.problems },
        },
      }),
    );
  }
  const fresh = (await loadSet(set.id)) as ViewSetWithViews;
  await Promise.all(
    rows.map((row) =>
      row.status === 'drawing'
        ? startRedraw(fresh, row, storedQa(row).problems)
        : startUpscale(fresh, row),
    ),
  );
}

async function advanceViews(set: ViewSetWithViews) {
  // The worker that cut the sheet died before it made every view.
  if (
    set.views.length < VIEWS.length &&
    set.sheetKey &&
    Date.now() - set.updatedAt.getTime() > VIEW_STALE_MS
  ) {
    const { count } = await db().viewSet.updateMany({
      where: { id: set.id, status: 'processing', updatedAt: set.updatedAt },
      data: { error: null },
    });
    if (!count) return;
    await seedViews(set, await getFile(set.sheetKey));
    return;
  }
  await Promise.all(
    set.views
      .filter((view) => view.status !== 'ready')
      .map((view) =>
        advanceView(set, view).catch((error) => {
          reportError(error, { viewSetId: set.id, view: view.view, stage: 'product_view' });
        }),
      ),
  );
  await refreshSetStatus(set.id);
}

// The set is ready when every view is.
async function refreshSetStatus(id: string) {
  const owner = await db().viewSet.findUnique({ where: { id }, select: { userId: true } });
  if (!owner) return;
  await db().$transaction(async (tx) => {
    await lockRenderActor(tx, { userId: owner.userId });
    const set = await tx.viewSet.findUnique({ where: { id } });
    if (set?.status !== 'processing') return;
    const open = await tx.productView.count({ where: { setId: id, status: { not: 'ready' } } });
    const total = await tx.productView.count({ where: { setId: id } });
    if (open === 0 && total === VIEWS.length) {
      await tx.viewSet.updateMany({
        where: { id, status: 'processing', updatedAt: set.updatedAt },
        data: { status: 'ready' },
      });
    }
  });
}

async function advanceView(set: ViewSetWithViews, view: ProductView) {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 3 * 60 * 1000);
  const claimed = await db().$executeRaw`UPDATE "ProductView" SET "advanceAfter" = ${leaseUntil}
    WHERE "id" = ${view.id} AND ("advanceAfter" IS NULL OR "advanceAfter" <= ${now})`;
  if (!claimed) return;
  try {
    const current = await db().productView.findUnique({ where: { id: view.id } });
    if (!current || current.status === 'ready') return;
    view = current;
    const stale = Date.now() - view.updatedAt.getTime() > VIEW_STALE_MS;
    if (!view.predictionId) {
      if (stale) await settleFromBest(set, view);
      return;
    }
    const prediction = await replicate().get(view.predictionId);
    if (!isSettled(prediction.status)) {
      if (stale) await settleFromBest(set, view);
      return;
    }
    const url = prediction.status === 'succeeded' ? sheetOutputUrl(prediction.output) : null;
    if (view.status === 'upscaling') await finishUpscale(view, url);
    else if (view.status === 'drawing') await finishRedraw(set, view, url);
  } catch (error) {
    if (Date.now() - view.updatedAt.getTime() > VIEW_STALE_MS) await settleFromBest(set, view);
    else throw error;
  } finally {
    // Raw update leaves the generation's timeout clock untouched.
    await db().$executeRaw`UPDATE "ProductView" SET "advanceAfter" = NULL
      WHERE "id" = ${view.id} AND "advanceAfter" = ${leaseUntil}`;
  }
}

// The upscaled picture is finished on the canvas. A failed upscale is not a failed view: the
// drawn picture is finished instead (it is enlarged by the canvas fit, just not by the model).
async function finishUpscale(view: ProductView, url: string | null) {
  const bytes = url ? await download(url) : await getFile(view.rawKey as string);
  await finalize(view, bytes, url ? ENLARGE_MODEL.costUsd : 0);
}

async function finalize(view: ProductView, bytes: Uint8Array, costUsd = 0) {
  const key = await putFile('views/view.jpg', await finishView(bytes), 'image/jpeg');
  await transitionView(
    view,
    { status: 'ready', key, predictionId: null, isPolishing: false, version: { increment: 1 } },
    costUsd,
  );
}

// What a redraw gave back: kept when it passes, drawn once more when it does not, and when the
// tries run out the better of the two pictures goes on, flagged.
async function finishRedraw(set: ViewSetWithViews, view: ProductView, url: string | null) {
  const limits = (await harness()).limits;
  const candidate = url ? await download(url) : null;
  const previous = storedQa(view);
  if (!candidate) {
    if (view.attempts < limits.viewMaxRetries) {
      const next = await transitionView(view, { attempts: { increment: 1 }, predictionId: null });
      if (next) await startRedraw(set, next, previous.problems);
      return;
    }
    if (view.isPolishing) return revertPolish(set, view);
    const next = await transitionView(view, { status: 'upscaling', predictionId: null });
    if (next) await startUpscale(set, next);
    return;
  }
  const check = await checkView(
    candidate,
    await measureObject(await getFile(set.sourceKey)),
    limits,
  );
  const qa = { ...check.measures, problems: check.problems };
  if (!check.ok && view.attempts < limits.viewMaxRetries) {
    const isBetter =
      betterView({ problems: check.problems, sharpness: check.measures.sharpness }, previous) ===
      'a';
    const next = await transitionView(
      view,
      {
        attempts: { increment: 1 },
        predictionId: null,
        ...(isBetter ? { rawKey: await putFile('views/raw.png', candidate, 'image/png'), qa } : {}),
      },
      SHEET_MODEL.costUsd,
    );
    if (next) await startRedraw(set, next, check.problems);
    return;
  }
  const isKept =
    view.isPolishing ||
    check.ok ||
    betterView({ problems: check.problems, sharpness: check.measures.sharpness }, previous) === 'a';
  const next = await transitionView(
    view,
    {
      status: 'upscaling',
      predictionId: null,
      ...(isKept ? { rawKey: await putFile('views/raw.png', candidate, 'image/png'), qa } : {}),
    },
    SHEET_MODEL.costUsd,
  );
  if (next) await startUpscale(set, next);
}

// Draws one view again: after a failed check (from the photo and what was wrong), or as the
// owner's polish (from the photo, the current view and their note).
async function startRedraw(set: ViewSetWithViews, view: ProductView, problems: ViewProblem[]) {
  const claimed = await transitionView(view, { predictionId: null });
  if (!claimed) return;
  view = claimed;
  let hasStarted = false;
  try {
    const client = replicate();
    const source = await getFile(set.sourceKey);
    const sourceType = contentTypeOf(set.sourceKey);
    const sourceUrl = await client.upload(source, `source.${extension(sourceType)}`, sourceType);
    const hasDraft = view.isPolishing && view.attempts === 0 && Boolean(view.key);
    const draftUrl = hasDraft
      ? await client.upload(await getFile(view.key as string), 'view.jpg', 'image/jpeg')
      : null;
    const recipe = await harness();
    const skill = selectSkillFrom(recipe.skills, set.name, set.prompt);
    const request = viewRequest(
      sourceUrl,
      draftUrl,
      viewPrompt({
        view: view.view as ViewId,
        note: view.isPolishing ? view.note : null,
        problems,
        hasDraft,
        skill,
        materials: selectMaterialsFrom(recipe.materials, set.name, set.prompt),
        productNote: set.prompt,
      }),
      DEFAULT_SHEET_SETTINGS,
    );
    const prediction = await client.start(request.path, request.body, webhook(set.id));
    hasStarted = true;
    await transitionView(view, { status: 'drawing', predictionId: prediction.id });
  } catch (error) {
    reportError(error, { viewSetId: set.id, view: view.view, stage: 'product_view_redraw_start' });
    if (hasStarted || (error instanceof ProviderRequestError && error.isAmbiguous)) return;
    if (view.isPolishing) return revertPolish(set, view);
    await startUpscale(set, view);
  }
}

// Upscales the drawn view; any problem on the way finishes it without the model instead.
async function startUpscale(set: ViewSetWithViews, view: ProductView) {
  const claimed = await transitionView(view, { predictionId: null });
  if (!claimed) return;
  view = claimed;
  let hasStarted = false;
  const raw = await getFile(view.rawKey as string);
  try {
    if (!needsUpscale(await imageSide(raw))) return await finalize(view, raw);
    const client = replicate();
    const imageUrl = await client.upload(raw, 'view.png', 'image/png');
    const request = enlargeRequest(imageUrl);
    const prediction = await client.start(request.path, request.body, webhook(set.id));
    hasStarted = true;
    await transitionView(view, { status: 'upscaling', predictionId: prediction.id });
  } catch (error) {
    reportError(error, { viewSetId: set.id, view: view.view, stage: 'product_view_upscale_start' });
    if (hasStarted || (error instanceof ProviderRequestError && error.isAmbiguous)) return;
    await finalize(view, raw);
  }
}

// A step that never settled: finish with the best picture there is, or hand a polish back.
async function settleFromBest(set: ViewSetWithViews, view: ProductView) {
  if (view.isPolishing && view.key) return revertPolish(set, view);
  if (view.rawKey) return finalize(view, await getFile(view.rawKey));
}

// A polish that could not be drawn goes back to the view the owner had, and is refunded.
async function revertPolish(set: ViewSetWithViews, view: ProductView) {
  await db().$transaction(async (tx) => {
    const { count } = await tx.productView.updateMany({
      where: {
        id: view.id,
        status: view.status,
        updatedAt: view.updatedAt,
        predictionId: view.predictionId,
        isPolishing: true,
        polishes: view.polishes,
      },
      data: { status: 'ready', isPolishing: false, predictionId: null },
    });
    if (!count) return;
    await grantCreditsInTransaction(tx, {
      userId: set.userId,
      amount: VIEW_POLISH_CREDITS,
      key: `refund:polish:${view.id}:${view.polishes}`,
      reason: 'product_view_polish_failed',
    });
  });
}

// --- Polishing and the 3D upsell -----------------------------------------------------------

// Draws one view again, steered by what the owner says is wrong with it. It costs one view
// (VIEW_POLISH_CREDITS), is refunded if it cannot be drawn, and the view they have stays until the
// new one is ready.
export async function polishView(
  id: string,
  viewId: string,
  actor: Actor,
  note: string,
): Promise<ViewSetWithViews> {
  if (!actor.userId) throw new AppError('Sign in to polish a view', 401, 'sign_in');
  const fix = cleanNote(note);
  if (!fix) throw new AppError('Describe what to fix in this view', 400, 'empty_note');
  const check = checkNote(fix);
  if (!check.ok) throw new AppError(check.message, 400, check.code);
  if (!isViewId(viewId)) throw notFound();
  const set = await ownedSet(id, actor);
  const view = set.views.find((item) => item.view === viewId);
  if (!view || set.status !== 'ready' || view.status !== 'ready') {
    throw new AppError('Wait until the views are ready to polish one', 409, 'bad_state');
  }

  const claimed = await db().$transaction(async (tx) => {
    await lockRenderActor(tx, actor);
    const current = await tx.productView.findUnique({ where: { id: view.id } });
    if (current?.status !== 'ready' || current.polishes !== view.polishes) return null;
    await assertGenerationConcurrency(actor, tx);
    const { count } = await tx.productView.updateMany({
      where: { id: view.id, status: 'ready', polishes: view.polishes },
      data: {
        status: 'drawing',
        isPolishing: true,
        note: fix,
        polishes: { increment: 1 },
        attempts: 0,
        predictionId: null,
      },
    });
    if (!count) return null;
    assertAuthorizedCredits(VIEW_POLISH_CREDITS, actor);
    await tx.viewSet.updateMany({ where: { id, status: 'ready' }, data: { status: 'processing' } });
    const claimed = await tx.productView.findUniqueOrThrow({ where: { id: view.id } });
    await spendCreditsInTransaction(tx, {
      apiKeyId: actor.apiKeyId,
      userId: actor.userId as string,
      amount: VIEW_POLISH_CREDITS,
      key: `polish:${view.id}:${claimed.polishes}`,
      reason: 'product_view_polish',
    });
    return claimed;
  });
  if (!claimed) return (await loadSet(id)) as ViewSetWithViews;
  await startRedraw(set, claimed, []);
  await refreshSetStatus(id);
  const after = (await loadSet(id)) as ViewSetWithViews;
  if (after.views.find((item) => item.view === viewId)?.status === 'ready') {
    throw new AppError('Could not redraw this view. Your credits were refunded.', 502, 'upstream');
  }
  return after;
}

// Starts a 3D render from the finished views: the views are laid back into a sheet and a render
// is created from it, ready to build for the 3D step only (the sheet is already paid for here).
// Returns the render id; asking again returns the same one.
export async function createRenderFromViews(id: string, actor: Actor): Promise<string> {
  const set = await ownedSet(id, actor);
  if (set.status !== 'ready') {
    throw new AppError('Wait until the views are ready', 409, 'bad_state');
  }
  if (set.renderId) return set.renderId;

  const byView = new Map(set.views.map((view) => [view.view, view]));
  const images = await Promise.all(
    VIEWS.map(async (name) => {
      const key = byView.get(name)?.key;
      if (!key) throw new AppError('Some views are missing', 409, 'bad_state');
      return getFile(key);
    }),
  );
  const sheetKey = await putFile('sheets/sheet.png', await composeSheet(images), 'image/png');
  return db().$transaction(async (tx) => {
    await lockRenderActor(tx, actor);
    const current = await tx.viewSet.findUniqueOrThrow({ where: { id } });
    if (current.renderId) return current.renderId;
    if (current.status !== 'ready')
      throw new AppError('Wait until the views are ready', 409, 'bad_state');
    const render = await tx.render.create({
      data: {
        userId: set.userId,
        prompt: set.prompt,
        name: set.name,
        sourceKey: set.sourceKey,
        sourceUrl: set.sourceUrl,
        sheetKey,
        hasFinalSheet: true,
        status: 'preview_ready',
        // Product photos are private by default: the owner chooses to publish the 3D model.
        isPublic: false,
        source: actor.source ?? (actor.apiKeyId ? 'api' : 'web'),
      },
    });
    await tx.viewSet.update({ where: { id }, data: { renderId: render.id } });
    return render.id;
  });
}

// --- Reading -------------------------------------------------------------------------------

export type ProductViewItem = {
  view: ViewId;
  status: ProductView['status'];
  hasImage: boolean;
  // Changes when the picture does, so a browser never shows a cached older one.
  version: number;
  // True when the checks found something on the picture that is kept: worth a look and a polish.
  isFlagged: boolean;
  problems: ViewProblem[];
  isPolishing: boolean;
  note: string | null;
};

export type ViewSetView = {
  id: string;
  name: string | null;
  prompt: string | null;
  status: ViewSet['status'];
  error: string | null;
  views: ProductViewItem[];
  readyCount: number;
  viewCount: number;
  credits: number;
  polishCredits: number;
  upscaleCredits: number;
  buildCredits: number;
  renderId: string | null;
  createdAt: string;
};

export function toViewSetView(set: ViewSetWithViews): ViewSetView {
  const byView = new Map(set.views.map((view) => [view.view, view]));
  const views: ProductViewItem[] = VIEWS.map((name) => {
    const row = byView.get(name);
    const problems = row ? storedQa(row).problems : [];
    return {
      view: name,
      status: row?.status ?? 'drawing',
      hasImage: Boolean(row?.key),
      version: row?.version ?? 0,
      isFlagged: Boolean(row?.key) && problems.length > 0 && row?.status === 'ready',
      problems,
      isPolishing: row?.isPolishing ?? false,
      note: row?.note ?? null,
    };
  });
  return {
    id: set.id,
    name: set.name,
    prompt: set.prompt,
    status: set.status,
    error: set.status === 'failed' ? 'Generation failed. Your credits were refunded.' : null,
    views,
    readyCount: views.filter((view) => view.status === 'ready').length,
    viewCount: VIEWS.length,
    credits: set.status === 'failed' ? 0 : set.credits,
    polishCredits: VIEW_POLISH_CREDITS,
    upscaleCredits: UPSCALE_CREDITS,
    buildCredits: BUILD_FROM_VIEWS_CREDITS,
    renderId: set.renderId,
    createdAt: set.createdAt.toISOString(),
  };
}

// An owner's set, nudged forward when it is still running.
export async function getViewSet(id: string, actor: Actor): Promise<ViewSetWithViews> {
  const set = await ownedSet(id, actor);
  if (set.status === 'drafting' || set.status === 'processing') {
    return (await advanceViewSet(id)) ?? set;
  }
  return set;
}

const MAX_ADVANCE_PER_LIST = 4;

// The owner's sets, newest first; a few still running are nudged forward so the list makes
// progress even where Replicate cannot call the webhook (local dev).
export async function listViewSets(userId: string, take = 24): Promise<ViewSetWithViews[]> {
  const sets = await db().viewSet.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { views: true },
  });
  const running = sets
    .filter((set) => set.status === 'drafting' || set.status === 'processing')
    .slice(0, MAX_ADVANCE_PER_LIST);
  if (running.length === 0) return sets;
  const advanced = new Map(
    (await Promise.all(running.map((set) => advanceViewSet(set.id))))
      .filter((set) => set !== null)
      .map((set) => [set.id, set]),
  );
  return sets.map((set) => advanced.get(set.id) ?? set);
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export async function getViewImage(
  id: string,
  viewId: string,
  actor: Actor,
): Promise<{ bytes: Uint8Array; filename: string }> {
  if (!isViewId(viewId)) throw notFound();
  const set = await ownedSet(id, actor);
  const view = set.views.find((item) => item.view === viewId);
  if (!view?.key) throw notFound();
  return {
    bytes: await getFile(view.key),
    filename: `${slug(set.name ?? '') || 'product'}-${viewId.replace('_', '-')}.jpg`,
  };
}

// Every finished view in one archive, named by product and view.
export async function zipViewSet(
  id: string,
  actor: Actor,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const set = await ownedSet(id, actor);
  const base = slug(set.name ?? '') || 'product';
  const files = (
    await Promise.all(
      VIEWS.map(async (name) => {
        const key = set.views.find((view) => view.view === name)?.key;
        return key
          ? { name: `${base}-${name.replace('_', '-')}.jpg`, data: await getFile(key) }
          : null;
      }),
    )
  ).filter((file) => file !== null);
  if (files.length === 0) throw notFound();
  return { bytes: zipStore(files), filename: `${base}-views.zip` };
}

// The protected worker also recovers paid image operations whose client stopped polling.
export async function recoverAdvancedGenerations(
  take = 5,
): Promise<{ checked: number; failed: number }> {
  const limit = Math.min(Math.max(Math.trunc(take) || 1, 1), 20);
  const [sets, upscales] = await Promise.all([
    db().viewSet.findMany({
      where: { status: { in: ['drafting', 'processing'] } },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    }),
    db().upscale.findMany({
      where: { status: 'processing' },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    }),
  ]);
  const jobs = [
    ...sets.map((row) => ({ ...row, kind: 'views' as const })),
    ...upscales.map((row) => ({ ...row, kind: 'upscale' as const })),
  ]
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
    .slice(0, limit);
  let failed = 0;
  for (const job of jobs) {
    try {
      if (job.kind === 'views') await advanceViewSet(job.id);
      else await advanceUpscale(job.id);
    } catch (error) {
      failed++;
      reportError(error, { generationId: job.id, stage: 'advanced_generation_recovery' });
    }
  }
  return { checked: jobs.length, failed };
}
