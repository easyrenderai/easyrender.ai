import { db, type Render } from '@easyrender/db';
import { SHEET_CREDITS } from '@easyrender/harness';
import { captureRender } from './analytics';
import { grantCreditsInTransaction } from './credits';
import { withQuality } from './render-quality';
import { failureContext } from './renders-shared';
import { reportError } from './report';
import { queueRenderServiceEmail } from './service-email';

export async function fail(
  id: string,
  error: unknown,
  expected?: Pick<Render, 'status' | 'updatedAt'>,
) {
  const message = error instanceof Error ? error.message : String(error);
  // A render that timed out or never started is an expected lifecycle end: it is refunded and
  // shown as failed, so it is a warning that names the stage, not an unhandled exception.
  if (error instanceof TerminalRenderError) {
    reportError(
      error,
      { renderId: id, stage: error.stage ?? 'render_terminal', ...failureContext(error) },
      'warning',
    );
  } else {
    reportError(error, { renderId: id, stage: 'render', ...failureContext(error) });
  }
  const render = await db().render.findUnique({ where: { id } });
  if (!render || !['drafting', 'rendering'].includes(render.status)) return;
  // The terminal state and refund commit together. If any wallet/ledger write fails, the
  // render remains in flight and a webhook, polling request or recovery worker can retry.
  const changed = await db().$transaction(async (tx) => {
    const isRedraw = render.status === 'drafting' && Boolean(render.sheetKey);
    const amount = isRedraw ? SHEET_CREDITS : render.credits;
    const refundedCredits = render.userId ? amount : 0;
    const { count } = await tx.render.updateMany({
      where: {
        id,
        status: expected?.status ?? render.status,
        updatedAt: expected?.updatedAt ?? render.updatedAt,
      },
      data: isRedraw
        ? {
            status: 'preview_ready',
            error: null,
            quality: withQuality(render, { refundedCorrectionCredits: refundedCredits }),
          }
        : {
            status: 'failed',
            error: message.slice(0, 500),
            quality: withQuality(render, {
              failedStep: render.status === 'rendering' ? 'model' : 'preview',
            }),
          },
    });
    if (!count) return false;
    if (render.userId && refundedCredits > 0) {
      await grantCreditsInTransaction(tx, {
        userId: render.userId,
        amount,
        key: isRedraw ? `refund:${id}:redraw:${render.sheetRedraws}` : `refund:${id}`,
        reason: isRedraw ? 'sheet_redraw_failed' : 'render_failed',
        renderId: id,
      });
      if (isRedraw) {
        await tx.renderEdit.create({
          data: { renderId: id, kind: 'sheet_redraw_refund', credits: refundedCredits },
        });
      }
    }
    if (!isRedraw) await queueRenderServiceEmail(id, tx);
    return true;
  });
  if (!changed || (render.status === 'drafting' && render.sheetKey)) return;
  // A rejected sheet names its guard (`sheet rejected (sheet_repeated_views): ...`), so the rate of
  // each rejection can be read from analytics without sending it to the error tracker.
  const failureReason = /^sheet rejected \((\w+)\)/.exec(message)?.[1] ?? 'generation_failed';
  await captureRender(
    render.status === 'drafting' ? 'preview_failed' : 'render_failed',
    render,
    render.status === 'drafting'
      ? {
          failure_reason: failureReason,
          duration_ms: Date.now() - render.createdAt.getTime(),
          input_type: render.source === 'web' ? 'upload' : 'api',
          free_preview_consumed: false,
        }
      : {
          model_id: render.id,
          failure_reason: 'generation_failed',
          duration_ms: Date.now() - render.updatedAt.getTime(),
          credits_spent: render.credits,
          credits_refunded: render.userId ? render.credits : 0,
        },
  );
}

export class TerminalRenderError extends Error {
  constructor(
    message: string,
    // Which lifecycle step ended the render, for diagnostics.
    readonly stage?: string,
  ) {
    super(message);
  }
}
