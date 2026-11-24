import { db } from '@easyrender/db';
import { ROW_LIMIT } from './database';
import { maskEmail } from './masking';

type Purchase = {
  id: string;
  userId: string;
  credits: number;
  amountCents: number;
  currency: string;
  status: string;
  paidAt: Date | null;
  createdAt: Date;
};
type ShopifyPurchase = Omit<Purchase, 'paidAt'> & { isTest: boolean; creditedAt: Date | null };
type Ledger = {
  userId: string;
  delta: number;
  reason: string;
  purchaseId: string | null;
  createdAt: Date;
};
type User = { id: string; email: string; credits: number };
export type Buyer = {
  id: string;
  email: string;
  purchases: number;
  purchased: number;
  gifted: number;
  other: number;
  used: number;
  refunded: number;
  remaining: number;
  amounts: Record<string, number>;
  unknownAmounts: number;
  firstPurchase: string;
  lastPurchase: string;
};
const GIFT_REASONS = new Set([
  'outreach_credit_invite',
  'referral_welcome',
  'referral_kickback',
  'first_model_trial',
]);

/** Lifetime wallet facts, without guessing which credits were spent or inferring money from plans. */
export function aggregateBuyers(
  users: User[],
  purchases: Purchase[],
  ledger: Ledger[],
  shopify: ShopifyPurchase[] = [],
): Buyer[] {
  const wallets = new Map(users.map((user) => [user.id, user]));
  const buyers = new Map<string, Buyer>();
  function payment(
    userId: string,
    credits: number,
    date: Date,
    amount?: { currency: string; cents: number },
  ) {
    const user = wallets.get(userId);
    if (!user) return;
    const at = date.toISOString();
    const buyer = buyers.get(userId) ?? {
      id: userId,
      email: maskEmail(user.email),
      purchases: 0,
      purchased: 0,
      gifted: 0,
      other: 0,
      used: 0,
      refunded: 0,
      remaining: user.credits,
      amounts: {},
      unknownAmounts: 0,
      firstPurchase: at,
      lastPurchase: at,
    };
    buyer.purchases++;
    buyer.purchased += credits;
    if (amount) {
      const currency = amount.currency.toUpperCase();
      buyer.amounts[currency] = (buyer.amounts[currency] ?? 0) + amount.cents;
    } else buyer.unknownAmounts++;
    if (at < buyer.firstPurchase) buyer.firstPurchase = at;
    if (at > buyer.lastPurchase) buyer.lastPurchase = at;
    buyers.set(userId, buyer);
  }
  for (const p of purchases) {
    if (p.status === 'paid')
      payment(p.userId, p.credits, p.paidAt ?? p.createdAt, {
        currency: p.currency,
        cents: p.amountCents,
      });
  }
  for (const p of shopify) {
    if (p.status === 'active' && !p.isTest && p.creditedAt)
      payment(p.userId, p.credits, p.creditedAt, { currency: p.currency, cents: p.amountCents });
  }
  // Historical Stripe grants have no Purchase. Linked grants are never counted a second time.
  for (const row of ledger) {
    if (row.delta > 0 && !row.purchaseId && ['purchase', 'subscription'].includes(row.reason)) {
      payment(row.userId, row.delta, row.createdAt);
    }
  }
  for (const row of ledger) {
    const buyer = buyers.get(row.userId);
    if (!buyer) continue;
    if (row.reason === 'referral_kickback_reversed') buyer.gifted += row.delta;
    else if (row.delta < 0) buyer.used -= row.delta;
    else if (row.reason.endsWith('_failed') || row.reason === 'build_quality_refund')
      buyer.refunded += row.delta;
    else if (GIFT_REASONS.has(row.reason)) buyer.gifted += row.delta;
    else if (!['purchase', 'subscription', 'shopify_purchase'].includes(row.reason))
      buyer.other += row.delta;
  }
  // Shopify test grants use the same reason as real grants; only the purchase knows they are tests.
  for (const p of shopify) {
    const buyer = buyers.get(p.userId);
    if (buyer && p.isTest && p.creditedAt) buyer.other += p.credits;
  }
  return [...buyers.values()].sort(
    (a, b) => b.lastPurchase.localeCompare(a.lastPurchase) || a.id.localeCompare(b.id),
  );
}

/** Admin-only caller required. Bounded read-only snapshot, matching the existing analytics policy. */
export async function loadBuyers(): Promise<Buyer[]> {
  return db().$transaction(
    async (client) => {
      const [users, purchases, ledger, shopify] = await Promise.all([
        client.user.findMany({
          take: ROW_LIMIT + 1,
          select: { id: true, email: true, credits: true },
        }),
        client.purchase.findMany({
          where: { status: 'paid' },
          take: ROW_LIMIT + 1,
          select: {
            id: true,
            userId: true,
            credits: true,
            amountCents: true,
            currency: true,
            status: true,
            paidAt: true,
            createdAt: true,
          },
        }),
        client.creditLedger.findMany({
          take: ROW_LIMIT + 1,
          select: {
            userId: true,
            delta: true,
            reason: true,
            purchaseId: true,
            createdAt: true,
          },
        }),
        client.shopifyPurchase.findMany({
          where: { status: 'active', creditedAt: { not: null } },
          take: ROW_LIMIT + 1,
          select: {
            id: true,
            userId: true,
            credits: true,
            amountCents: true,
            currency: true,
            status: true,
            isTest: true,
            creditedAt: true,
            createdAt: true,
          },
        }),
      ]);
      if ([users, purchases, ledger, shopify].some((rows) => rows.length > ROW_LIMIT))
        throw new Error('analyticsRowLimit');
      return aggregateBuyers(users, purchases, ledger, shopify);
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
