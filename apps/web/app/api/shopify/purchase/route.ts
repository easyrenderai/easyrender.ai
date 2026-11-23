import {
  AppError,
  bearerSessionToken,
  createShopifyPurchase,
  verifySessionToken,
} from '@easyrender/core';
import { NextResponse } from 'next/server';
import { handle } from '@/lib/http';

// Body: { credits }. Starts a purchase of one credit pack billed by Shopify and returns the Shopify
// page where the merchant approves it. The credits arrive once Shopify says the charge is active.
export const POST = (request: Request) =>
  handle(async () => {
    const token = bearerSessionToken(request.headers);
    if (!token) throw new AppError('Open this page from Shopify', 401, 'bad_session');
    const shop = verifySessionToken(token);
    const body = await request.json().catch(() => null);
    if (typeof body?.credits !== 'number') {
      throw new AppError('Send credits', 400, 'bad_body');
    }
    return NextResponse.json(await createShopifyPurchase(shop, token, { credits: body.credits }));
  });
