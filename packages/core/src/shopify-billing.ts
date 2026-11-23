import { db } from '@easyrender/db';
import { PAYG, paygPriceCents } from '@easyrender/harness';
import { grantCreditsInTransaction } from './credits';
import { AppError } from './errors';
import {
  decryptToken,
  ensureShop,
  type ShopifyGraphqlFetch,
  shopifyEnv,
  shopifyGraphql,
} from './shopify';

// Credit packs sold inside the Shopify app. Shopify requires an App Store app to charge through its
// own billing, so a pack is a one-time app purchase (appPurchaseOneTimeCreate): the merchant approves
// it on a Shopify page, Shopify invoices the shop, and the credits go to the easyrender account the
// shop is linked to. Shopify App Pricing has no one-time purchases, hence the Billing API.
//
// The price of a pack is the pay-as-you-go price (pricing.ts); Shopify takes no revenue share on the
// first $1M of app revenue, so there is no markup. A charge is only trusted after reading it back
// from Shopify (webhook payloads and the return page are never believed): the credits are granted
// once, through the ledger, when Shopify says the charge is active.

const SHOPIFY_PURCHASE_REASON = 'shopify_purchase';

// Shopify does not bill a development store, and anyone can open any number of them. A test charge
// therefore grants credits only once per easyrender account, enough to try the app and to pass
// Shopify's review without letting free credits be minted.
const TEST_CREDITED_PURCHASES_PER_ACCOUNT = 1;

export type ShopifyPack = { credits: number; priceCents: number };

export const shopifyPacks = (): ShopifyPack[] =>
  PAYG.presets.map((credits) => ({ credits, priceCents: paygPriceCents(credits) }));

type ChargeStatus = 'ACTIVE' | 'ACCEPTED' | 'PENDING' | 'DECLINED' | 'EXPIRED' | string;

const CREATE_CHARGE = `mutation Buy($name: String!, $price: MoneyInput!, $returnUrl: URL!, $test: Boolean) {
  appPurchaseOneTimeCreate(name: $name, price: $price, returnUrl: $returnUrl, test: $test) {
    appPurchaseOneTime { id }
    confirmationUrl
    userErrors { field message }
  }
}`;

const READ_CHARGE = `query Charge($id: ID!) {
  node(id: $id) {
    ... on AppPurchaseOneTime { id status test price { amount currencyCode } }
  }
}`;

const SHOP_PLAN = `{ shop { plan { partnerDevelopment } } }`;

const centsOf = (amount: string | number) => Math.round(Number(amount) * 100);

// Where the merchant lands after approving or declining: the app, inside the Shopify admin.
const returnUrl = (shop: string) => `https://${shop}/admin/apps/${shopifyEnv.apiKey()}`;

async function storedToken(shop: string): Promise<string> {
  const row = await db().shopifyShop.findUnique({ where: { shop } });
  if (!row) throw new AppError('Open the app in Shopify first', 404, 'shop_not_installed');
  return decryptToken(row.accessToken);
}

// Starts a purchase of one pack and returns the Shopify page where the merchant approves it.
export async function createShopifyPurchase(
  shop: string,
  sessionToken: string,
  input: { credits: number },
  fetchImpl: ShopifyGraphqlFetch = fetch,
): Promise<{ confirmationUrl: string }> {
  const pack = shopifyPacks().find((candidate) => candidate.credits === input.credits);
  if (!pack) throw new AppError('Pick one of the credit packs', 400, 'bad_pack');
  const row = await ensureShop(shop, sessionToken, fetchImpl);
  if (!row.userId) {
    throw new AppError('Connect an easyrender account first', 409, 'not_linked');
  }
  const accessToken = decryptToken(row.accessToken);
  const plan = await shopifyGraphql<{ shop: { plan: { partnerDevelopment: boolean } } }>(
    shop,
    accessToken,
    SHOP_PLAN,
    {},
    fetchImpl,
  );
  const isTest = plan.shop.plan.partnerDevelopment;
  const data = await shopifyGraphql<{
    appPurchaseOneTimeCreate: {
      appPurchaseOneTime: { id: string } | null;
      confirmationUrl: string | null;
      userErrors: { message: string }[];
    };
  }>(
    shop,
    accessToken,
    CREATE_CHARGE,
    {
      name: `${pack.credits} credits`,
      price: { amount: (pack.priceCents / 100).toFixed(2), currencyCode: 'USD' },
      returnUrl: returnUrl(shop),
      test: isTest,
    },
    fetchImpl,
  );
  const created = data.appPurchaseOneTimeCreate;
  const confirmationUrl = created.confirmationUrl;
  const chargeId = created.appPurchaseOneTime?.id;
  if (created.userErrors[0] || !confirmationUrl || !chargeId) {
    throw new AppError(
      `Shopify error: ${created.userErrors[0]?.message ?? 'no charge was created'}`,
      502,
      'shopify_billing',
    );
  }
  if (!confirmationUrl.startsWith('https://')) {
    throw new AppError('Shopify sent an unexpected approval address', 502, 'shopify_billing');
  }
  await db().shopifyPurchase.create({
    data: {
      shop,
      userId: row.userId,
      chargeId,
      credits: pack.credits,
      amountCents: pack.priceCents,
      isTest,
    },
  });
  return { confirmationUrl };
}

// Reads one charge back from Shopify and, when it is active, grants the credits once. Safe to call
// from the webhook and from the page: a charge settles only once, and a second call is a no-op.
export async function settleShopifyPurchase(
  chargeId: string,
  fetchImpl: ShopifyGraphqlFetch = fetch,
): Promise<'unknown' | 'pending' | 'active' | 'declined' | 'expired'> {
  const purchase = await db().shopifyPurchase.findUnique({ where: { chargeId } });
  if (!purchase) return 'unknown';
  if (purchase.status !== 'pending') return purchase.status as 'active' | 'declined' | 'expired';

  const data = await shopifyGraphql<{
    node: {
      status: ChargeStatus;
      test: boolean;
      price: { amount: string; currencyCode: string };
    } | null;
  }>(purchase.shop, await storedToken(purchase.shop), READ_CHARGE, { id: chargeId }, fetchImpl);
  const charge = data.node;
  if (!charge) return 'pending';
  if (charge.status === 'DECLINED' || charge.status === 'EXPIRED') {
    const status = charge.status === 'DECLINED' ? 'declined' : 'expired';
    await db().shopifyPurchase.updateMany({
      where: { chargeId, status: 'pending' },
      data: { status },
    });
    return status;
  }
  if (charge.status !== 'ACTIVE') return 'pending';
  // Never credit a charge that is not the one we created.
  if (
    centsOf(charge.price.amount) !== purchase.amountCents ||
    charge.price.currencyCode !== 'USD'
  ) {
    throw new AppError('The Shopify charge does not match the pack', 502, 'shopify_billing');
  }

  await db().$transaction(async (tx) => {
    const { count } = await tx.shopifyPurchase.updateMany({
      where: { chargeId, status: 'pending' },
      data: { status: 'active', isTest: charge.test },
    });
    if (count === 0) return;
    if (charge.test) {
      const credited = await tx.shopifyPurchase.count({
        where: { userId: purchase.userId, isTest: true, creditedAt: { not: null } },
      });
      if (credited >= TEST_CREDITED_PURCHASES_PER_ACCOUNT) return;
    }
    await grantCreditsInTransaction(tx, {
      userId: purchase.userId,
      amount: purchase.credits,
      key: `shopify:purchase:${chargeId}`,
      reason: SHOPIFY_PURCHASE_REASON,
    });
    await tx.shopifyPurchase.update({ where: { chargeId }, data: { creditedAt: new Date() } });
  });
  return 'active';
}

// Settles every charge of this shop that is still waiting. The page calls it each time it opens, so
// credits show up right after the merchant returns from Shopify even if the webhook is late.
// Returns how many are still waiting.
export async function settlePendingPurchases(
  shop: string,
  fetchImpl: ShopifyGraphqlFetch = fetch,
): Promise<number> {
  const pending = await db().shopifyPurchase.findMany({
    where: { shop, status: 'pending' },
    select: { chargeId: true },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
  let waiting = 0;
  for (const { chargeId } of pending) {
    try {
      if ((await settleShopifyPurchase(chargeId, fetchImpl)) === 'pending') waiting += 1;
    } catch {
      // Shopify is unreachable or refused; the charge stays pending and the next call tries again.
      waiting += 1;
    }
  }
  return waiting;
}
