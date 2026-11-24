import { isShopDomain, removeShop, settleShopifyPurchase, verifyWebhook } from '@easyrender/core';
import { NextResponse } from 'next/server';

// Shopify's webhooks, declared in plugins/shopify/shopify.app.toml. Each is signed with the app
// secret over the raw body. The three privacy topics need a 200: easyrender stores no shopper data
// (products and photos only), so there is nothing to export or erase for a customer.
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWebhook(raw, request.headers.get('x-shopify-hmac-sha256'))) {
    return new NextResponse('Invalid signature', { status: 401 });
  }
  const topic = request.headers.get('x-shopify-topic');
  const shop = request.headers.get('x-shopify-shop-domain');
  if (topic === 'app/uninstalled' && isShopDomain(shop)) await removeShop(shop);
  if (topic === 'shop/redact' && isShopDomain(shop)) await removeShop(shop);
  // A pack was approved, declined or expired. The payload is only a pointer: the charge is read back
  // from Shopify before anything is credited.
  if (topic === 'app_purchases_one_time/update') {
    const chargeId = JSON.parse(raw)?.app_purchase_one_time?.admin_graphql_api_id;
    if (typeof chargeId === 'string') await settleShopifyPurchase(chargeId);
  }
  return NextResponse.json({ ok: true });
}
