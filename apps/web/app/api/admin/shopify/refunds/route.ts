import { AppError, refundShopifyPurchase } from '@easyrender/core';
import { adminDecision } from '@easyrender/core/admin-analytics';
import { revalidateTag } from 'next/cache';
import { adminSession } from '@/lib/admin-analytics/session';
import { errorResponse } from '@/lib/http';

// Records that a Shopify credit pack was refunded in the Partner Dashboard: takes back the unspent
// credits and marks the purchase refunded. Shopify sends no refund webhook, so an admin calls this.
// See docs/shopify-refunds.md.
export async function POST(request: Request): Promise<Response> {
  let response: Response;
  try {
    // Browser-session administration only; bearer credentials never bypass CSRF protection.
    if (request.headers.get('origin') !== new URL(request.url).origin)
      throw new AppError('Same-origin request required', 403, 'unauthorized_origin');
    const session = await adminSession(request.headers);
    const decision = adminDecision(session?.user ?? null, process.env.ADMIN_EMAILS ?? '', true);
    if (decision !== 'allow')
      throw new AppError(
        'Administrator access required',
        decision === 'signin' ? 401 : 403,
        'unauthorized',
      );
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
      throw new AppError('Send application/json', 415, 'bad_content_type');
    const body = (await request.json().catch(() => null)) as { chargeId?: unknown } | null;
    const chargeId = body?.chargeId;
    if (typeof chargeId !== 'string' || !chargeId.startsWith('gid://shopify/AppPurchaseOneTime/'))
      throw new AppError(
        'Send the charge id (gid://shopify/AppPurchaseOneTime/...)',
        400,
        'bad_body',
      );
    const result = await refundShopifyPurchase(chargeId);
    revalidateTag('admin-analytics', { expire: 0 });
    response = Response.json(result);
  } catch (error) {
    response = errorResponse(error);
  }
  response.headers.set('cache-control', 'no-store');
  return response;
}
