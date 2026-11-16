import { db } from '@easyrender/db';
import { PRICING_FLAG } from '@easyrender/harness';
import { captureServer } from './analytics';
import { ATTRIBUTION_KEYS, type Attribution, hasFirstTouch, pickAttribution } from './attribution';
import { bindFirstModelEnrollment } from './first-model-experiment';
import { assignedPricing, pricingSubject } from './pricing-experiment';
import { reportError } from './report';

/** The existing anonymous ownership proof authorizes the preview, never stores attribution. */
export async function signupAttribution(input: {
  userId: string;
  anonId: string | null;
  attribution: Attribution;
  method: 'email' | 'google' | 'otro';
}) {
  try {
    await bindFirstModelEnrollment(input.userId, input.anonId);
  } catch {
    // An experiment must never prevent account creation; the owner page retries binding.
    reportError(new Error('Unable to bind first model experiment'), { component: 'experiment' });
  }
  const preview = input.anonId
    ? await db().render.findFirst({
        where: { anonId: input.anonId, userId: null },
        orderBy: { createdAt: 'asc' },
      })
    : null;
  const attribution =
    preview && hasFirstTouch(preview) ? pickAttribution(preview) : input.attribution;
  const result = await db().user.updateMany({
    where: { id: input.userId, AND: ATTRIBUTION_KEYS.map((key) => ({ [key]: null })) },
    data: attribution,
  });
  if (preview)
    await db().render.updateMany({
      where: { anonId: input.anonId, userId: null },
      data: { userId: input.userId },
    });
  if (result.count) {
    try {
      const id = `analytics-signup:${input.userId}`;
      await db().verification.create({
        data: {
          id,
          identifier: id,
          value: input.method,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } catch {
      reportError(new Error('Unable to record analytics signup receipt'), {
        component: 'analytics',
      });
    }
    const variant = await assignedPricing(input.userId, input.anonId);
    await captureServer(
      'signup',
      input.userId,
      { userId: input.userId, previewId: preview?.id ?? null, source: 'web', attribution },
      {
        pricing_subject: await pricingSubject(input.userId, input.anonId),
        pricing_variant: variant,
        [`$feature/${PRICING_FLAG}`]: variant,
        method: input.method,
        had_preview_before: Boolean(preview),
        preview_id_before: preview?.id ?? null,
      },
      preview ? `pv_${preview.id}` : undefined,
    );
  }
}
