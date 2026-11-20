import {
  AppError,
  bearerSessionToken,
  shopifyGenerate,
  verifySessionToken,
} from '@easyrender/core';
import { NextResponse } from 'next/server';
import { handle } from '@/lib/http';

export const maxDuration = 60;

// Body: { approvedCredits, isFirst, externalIds? }. Queues the next batch of up to 100 products; the
// page calls it until `remaining` is 0. `approvedCredits` is the price the merchant saw on the
// button. `externalIds` limits the run to the products the merchant ticked in the grid.
export const POST = (request: Request) =>
  handle(async () => {
    const token = bearerSessionToken(request.headers);
    if (!token) throw new AppError('Open this page from Shopify', 401, 'bad_session');
    const shop = verifySessionToken(token);
    const body = await request.json().catch(() => null);
    if (typeof body?.approvedCredits !== 'number') {
      throw new AppError('Send approvedCredits', 400, 'bad_body');
    }
    const ids: unknown = body.externalIds;
    if (
      ids !== undefined &&
      (!Array.isArray(ids) ||
        ids.length > 5000 ||
        ids.some((id) => typeof id !== 'string' || id.length > 128))
    ) {
      throw new AppError('Send externalIds as a list of product ids', 400, 'bad_body');
    }
    return NextResponse.json(
      await shopifyGenerate(shop, token, {
        approvedCredits: body.approvedCredits,
        isFirst: body.isFirst === true,
        externalIds: ids as string[] | undefined,
      }),
    );
  });
