import { db } from '@easyrender/db';
import {
  type ChargeCurrency,
  isBuildQuality,
  isPlanId,
  isValidPaygCredits,
  PAYG,
  PLAN_IDS,
  type PlanId,
  PRICING_FLAG,
  type PricingVariant,
  PUBLIC_PLAN_IDS,
  pricingFor,
  topupAmountCents,
  topupPricing,
  unitAmountCents,
} from '@easyrender/harness';
import Stripe from 'stripe';
import { captureServer, eventUuid } from './analytics';
import {
  type CheckoutAttribution,
  checkoutAttributionFromMetadata,
  checkoutAttributionMetadata,
  pickAttribution,
  sanitizeProperties,
} from './attribution';
import { config } from './config';
import { grantCredits } from './credits';
import { AppError } from './errors';
import { isGoogleMeasurementConfigured } from './google-measurement';
import { enqueueGooglePurchase, linkGoogleCheckout } from './google-outbox';
import { currencyForVisitor } from './pricing-context';
import {
  assignedPricing,
  pricingSubject,
  purchasedVariant,
  purchasePackId,
} from './pricing-experiment';
import { reportError } from './report';

let stripeClient: Stripe | null = null;
const stripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripeClient ??= new Stripe(key);
  return stripeClient;
};

// Without Stripe keys outside production, checkout is simulated so the flow can be tested end to end.
export const devCheckoutEnabled = () => !process.env.STRIPE_SECRET_KEY && !config.isProduction();

export type CheckoutRequest = { plan: 'payg'; credits: number } | { plan: PlanId };

export function parseCheckout(
  body: { plan?: unknown; credits?: unknown },
  variant: PricingVariant = 'control',
): CheckoutRequest {
  if (isPlanId(body.plan) && PUBLIC_PLAN_IDS.includes(body.plan)) return { plan: body.plan };
  if (body.plan === 'payg') {
    const credits = Number(body.credits);
    if (!isValidPaygCredits(credits, variant)) {
      throw new AppError(
        `Buy between ${PAYG.min.toLocaleString('en-US')} and ${PAYG.max.toLocaleString('en-US')} credits`,
        400,
        'bad_amount',
      );
    }
    return { plan: 'payg', credits };
  }
  throw new AppError('Unknown plan', 400, 'bad_plan');
}

// One Stripe price per product, named STRIPE_PRICE_PAYG, STRIPE_PRICE_CREATOR, STRIPE_PRICE_PRO...
const priceId = (product: 'payg' | PlanId, variant: PricingVariant) => {
  const id =
    process.env[`STRIPE_PRICE_${product.toUpperCase()}${variant === 'test' ? '_TEST' : ''}`];
  if (!id) throw new AppError('Payments are not configured', 503, 'no_stripe');
  return id;
};

// Euro-area visitors see and pay EUR; everyone else USD. EUR_CHECKOUT_DISABLED=1 is the kill switch
// that puts everyone back on USD. The pricing pages and checkout both ask here, so they agree.
export { currencyForVisitor };

/** A returning buyer stays in the currency of their last paid order, whatever country they browse from. */
export async function buyerCurrency(
  userId: string | null | undefined,
  country: string | null | undefined,
): Promise<ChargeCurrency> {
  if (userId) {
    const last = await db().purchase.findFirst({
      where: { userId, status: 'paid' },
      orderBy: { createdAt: 'desc' },
      select: { currency: true },
    });
    if (last?.currency === 'usd' || last?.currency === 'eur') return last.currency;
  }
  return currencyForVisitor(country);
}

// A Stripe customer is locked to the currency of its first invoice or subscription. Keep returning
// buyers in that currency, whatever country they browse from now.
async function checkoutCurrency(
  client: Stripe,
  userId: string,
  customerId: string | null,
  country: string | null | undefined,
): Promise<ChargeCurrency> {
  const wanted = await buyerCurrency(userId, country);
  if (!customerId) return wanted;
  const customer = await client.customers.retrieve(customerId);
  if ('deleted' in customer && customer.deleted) return wanted;
  if (customer.currency === 'usd' || customer.currency === 'eur') return customer.currency;
  return wanted;
}

/** Resolve the existing contract, never the client's plan or the current experiment arm.
 * Stripe is re-read when linked, including when the DB's last webhook is stale. In local
 * simulation only, the DB status/plan is sufficient. Unknown live contracts fail closed.
 */
export async function getTopupPricing(
  userId: string | null | undefined,
  variant: PricingVariant = 'control',
  currency: ChargeCurrency = 'usd',
) {
  if (!userId) return topupPricing(null, variant, currency);
  const user = await db().user.findUnique({
    where: { id: userId },
    select: {
      subscriptionId: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      stripeCustomerId: true,
    },
  });
  if (!user) throw new AppError('Sign in to buy credits', 401, 'unauthorized');
  const client = stripe();
  if (client && user.subscriptionId) {
    const subscription = await client.subscriptions.retrieve(user.subscriptionId);
    if (id(subscription.customer) !== user.stripeCustomerId)
      throw new AppError('Subscription customer mismatch', 503, 'price_mismatch');
    if (subscription.status !== 'active' && subscription.status !== 'trialing')
      return topupPricing(null, variant, currency);
    const contracts = subscription.items.data.flatMap((item) => {
      const plan = planForPrice(item.price);
      if (!plan) return [];
      const contractVariant: PricingVariant =
        process.env[`STRIPE_PRICE_${plan.toUpperCase()}_TEST`] === item.price.id
          ? 'test'
          : 'control';
      return [{ plan, variant: contractVariant }];
    });
    const contract = contracts[0];
    if (
      !contract ||
      contracts.length !== 1 ||
      (subscription.currency !== 'usd' && subscription.currency !== 'eur')
    )
      throw new AppError('Unknown subscription price', 503, 'price_mismatch');
    return topupPricing(
      { ...contract, status: subscription.status },
      variant,
      subscription.currency,
    );
  }
  const hasEligibleStatus =
    user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing';
  if (client && hasEligibleStatus)
    throw new AppError('Subscription is not linked', 503, 'price_mismatch');
  return topupPricing(
    { status: user.subscriptionStatus, plan: user.subscriptionPlan, variant },
    variant,
    currency,
  );
}

/** Only known render and product-view routes can be carried through checkout. Authorization is checked there. */
export function checkoutReturnPath(value: unknown): string | null {
  return typeof value === 'string' &&
    /^\/(?:r\/[A-Za-z0-9_-]+|views(?:\/[A-Za-z0-9_-]+)?)$/.test(value)
    ? value
    : null;
}

/**
 * Packs bought from a 3D build button come back to that render page, not to Credits, with the
 * build quality the buyer had picked. Only a render route qualifies; anything else keeps Credits.
 */
export function checkoutInlineReturn(input: {
  next?: unknown;
  inline?: unknown;
  quality?: unknown;
}) {
  const path = checkoutReturnPath(input.next);
  if (input.inline !== true || !path?.startsWith('/r/')) return null;
  const quality =
    isBuildQuality(input.quality) && input.quality !== 'low' ? `&quality=${input.quality}` : '';
  return { path, quality };
}

const devCheckoutUrl = (request: CheckoutRequest) =>
  request.plan === 'payg'
    ? `${config.appUrl()}/api/dev/checkout?plan=payg&credits=${request.credits}`
    : `${config.appUrl()}/api/dev/checkout?plan=${request.plan}`;

export async function createCheckoutDetails(
  userId: string,
  input: {
    plan?: unknown;
    credits?: unknown;
    expectedAmountCents?: unknown;
    expectedCurrency?: unknown;
    next?: unknown;
    inline?: unknown;
    quality?: unknown;
  },
  context: {
    anonId?: string | null;
    checkoutAttribution?: CheckoutAttribution;
    expectedVariant?: string | null;
    country?: string | null;
    locale?: Stripe.Checkout.SessionCreateParams.Locale;
  } = {},
) {
  // The caller supplies only a plan/quantity. Resolve again here, even for non-HTTP callers.
  const variant = await assignedPricing(userId, context.anonId);
  if (context.expectedVariant && context.expectedVariant !== variant)
    throw new AppError(
      'Pricing changed. Refresh the page before checking out.',
      409,
      'pricing_changed',
    );
  const request = parseCheckout(input, variant);
  const next = checkoutReturnPath(input.next);
  const inline = checkoutInlineReturn(input);
  const returnQuery = next
    ? `&next=${encodeURIComponent(next)}${inline ? `&inline=1${inline.quality}` : ''}`
    : '';
  const attributionMetadata = checkoutAttributionMetadata(context.checkoutAttribution ?? {});
  let metadata: Stripe.MetadataParam = {
    userId,
    plan: request.plan,
    pricing_variant: variant,
    pricing_flag: PRICING_FLAG,
    ...(context.locale ? { ui_locale: context.locale } : {}),
  };
  const client = stripe();
  if (!client) {
    if (devCheckoutEnabled())
      return { url: `${devCheckoutUrl(request)}${returnQuery}`, sessionId: null, analytics: null };
    throw new AppError('Payments are not configured', 503, 'no_stripe');
  }
  const user = await db().user.findUnique({
    where: { id: userId },
    select: { email: true, stripeCustomerId: true, subscriptionStatus: true },
  });
  if (!user) throw new AppError('Sign in to buy credits', 401, 'unauthorized');
  const customer = user.stripeCustomerId
    ? { customer: user.stripeCustomerId }
    : { customer_email: user.email };
  let currency = await checkoutCurrency(client, userId, user.stripeCustomerId, context.country);
  const topup = request.plan === 'payg' ? await getTopupPricing(userId, variant, currency) : null;
  if (topup) currency = topup.currency;
  const amountCents =
    request.plan === 'payg' && topup
      ? topupAmountCents(request.credits, topup)
      : unitAmountCents(request.plan, variant, currency);
  // These client values are only stale-display guards, never inputs to pricing.
  if (
    (input.expectedAmountCents !== undefined && input.expectedAmountCents !== amountCents) ||
    (input.expectedCurrency !== undefined && input.expectedCurrency !== currency)
  )
    throw new AppError(
      'Pricing changed. Refresh the page before checking out.',
      409,
      'pricing_changed',
    );
  let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  if (request.plan === 'payg' && topup?.plan) {
    lineItems = [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amountCents,
          product_data: {
            name: `${request.credits} credits`,
            metadata: { topup_plan: topup.plan },
          },
        },
      },
    ];
  } else {
    const selectedPrice = await client.prices.retrieve(priceId(request.plan, variant), {
      expand: ['currency_options'],
    });
    validateCheckoutPrice(selectedPrice, request.plan, variant, currency);
    lineItems = [
      { price: selectedPrice.id, quantity: request.plan === 'payg' ? request.credits : 1 },
    ];
  }
  if (request.plan === 'payg' && topup)
    metadata = {
      ...metadata,
      pricing_variant: topup.variant,
      credits: String(request.credits),
      ...(topup.plan
        ? { topup_plan: topup.plan, amount_cents: String(amountCents), currency }
        : {}),
    };
  // Always name the currency. Without it Stripe Checkout picks one from the buyer's location
  // whenever the price carries currency_options, so a euro-area buyer was charged in EUR even
  // with EUR checkout off and the pricing pages showing USD.
  const chargeCurrency = { currency };
  const analytics = {
    pricing_variant: topup?.variant ?? variant,
    value: amountCents / 100,
    currency: currency.toUpperCase(),
    items: [{ item_id: request.plan, quantity: request.plan === 'payg' ? request.credits : 1 }],
  };
  const localeQuery = context.locale ? `&locale=${encodeURIComponent(context.locale)}` : '';
  const urls = inline
    ? {
        success_url: `${config.appUrl()}${inline.path}?purchase=success&session_id={CHECKOUT_SESSION_ID}${inline.quality}${localeQuery}`,
        cancel_url: `${config.appUrl()}${inline.path}?purchase=canceled${inline.quality}${localeQuery}`,
      }
    : {
        success_url: `${config.appUrl()}/credits?status=success&session_id={CHECKOUT_SESSION_ID}${returnQuery}${localeQuery}`,
        cancel_url: `${config.appUrl()}/credits?status=canceled${returnQuery}${localeQuery}`,
      };

  if (request.plan !== 'payg') {
    if (isActiveSubscription(user.subscriptionStatus)) {
      throw new AppError(
        'You already have a monthly plan. Change it from billing.',
        409,
        'already_subscribed',
      );
    }
    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      locale: context.locale,
      client_reference_id: userId,
      ...customer,
      line_items: lineItems,
      metadata: { ...metadata, ...attributionMetadata },
      subscription_data: { metadata },
      adaptive_pricing: { enabled: false },
      ...chargeCurrency,
      ...urls,
    });
    if (!session.url) throw new AppError('Stripe did not return a checkout URL', 502, 'upstream');
    return { url: session.url, sessionId: session.id, analytics };
  }

  const session = await client.checkout.sessions.create({
    mode: 'payment',
    locale: context.locale,
    client_reference_id: userId,
    ...customer,
    ...(user.stripeCustomerId ? {} : { customer_creation: 'always' as const }),
    line_items: lineItems,
    metadata: { ...metadata, ...attributionMetadata },
    adaptive_pricing: { enabled: false },
    ...chargeCurrency,
    ...urls,
  });
  await db().purchase.create({
    data: {
      userId,
      stripeSessionId: session.id,
      packId: purchasePackId(
        topup?.plan ? `topup_${topup.plan}` : 'payg',
        topup?.variant ?? variant,
      ),
      credits: request.credits,
      amountCents,
      currency,
    },
  });
  if (!session.url) throw new AppError('Stripe did not return a checkout URL', 502, 'upstream');
  return { url: session.url, sessionId: session.id, analytics };
}

/** Keep the URL-only core API compatible with existing callers. */
export function validateCheckoutPrice(
  price: Stripe.Price,
  plan: 'payg' | PlanId,
  variant: PricingVariant,
  currency: ChargeCurrency = 'usd',
) {
  const amount = unitAmountCents(plan, variant, 'usd');
  const isRecurring = plan !== 'payg';
  if (
    !price.active ||
    price.currency !== 'usd' ||
    price.unit_amount !== amount ||
    (currency === 'eur' &&
      price.currency_options?.eur?.unit_amount !== unitAmountCents(plan, variant, 'eur')) ||
    price.billing_scheme !== 'per_unit' ||
    price.transform_quantity ||
    (isRecurring
      ? price.recurring?.interval !== 'month' ||
        price.recurring?.interval_count !== 1 ||
        price.recurring?.usage_type !== 'licensed'
      : price.recurring !== null)
  ) {
    throw new AppError('Payments are not configured for this price', 503, 'price_mismatch');
  }
}

export const isActiveSubscription = (status: string | null | undefined) =>
  status === 'active' || status === 'trialing' || status === 'past_due';

// Stripe's customer portal: change card, see invoices, change or cancel the monthly plan.
export async function createBillingPortal(
  userId: string,
  locale?: Stripe.BillingPortal.SessionCreateParams.Locale,
): Promise<string> {
  const client = stripe();
  const user = await db().user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (!client || !user?.stripeCustomerId) {
    throw new AppError('No billing account yet', 404, 'no_customer');
  }
  const session = await client.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    locale,
    return_url: `${config.appUrl()}/credits${locale ? `?locale=${encodeURIComponent(locale)}` : ''}`,
  });
  return session.url;
}

export async function devGrant(
  userId: string,
  input: CheckoutRequest,
  anonId: string | null = null,
) {
  const variant = await assignedPricing(userId, anonId);
  const request = parseCheckout(input, variant);
  if (!devCheckoutEnabled()) throw new AppError('Not available', 404, 'not_found');
  const isPayg = request.plan === 'payg';
  if (!isPayg) {
    await db().user.update({
      where: { id: userId },
      data: { subscriptionStatus: 'active', subscriptionPlan: request.plan },
    });
  }
  await grantCredits({
    userId,
    amount: isPayg ? request.credits : pricingFor(variant).plans[request.plan].monthlyCredits,
    key: `dev:${userId}:${Date.now()}`,
    reason: isPayg ? 'dev_purchase' : 'dev_subscription',
  });
}

const id = (value: string | { id: string } | null | undefined) =>
  typeof value === 'string' ? value : (value?.id ?? null);

// The plan a Stripe price belongs to, from the STRIPE_PRICE_* env vars. The price is the truth:
// the plan tag on the subscription is written once at checkout and stays put when the customer
// switches plan in the billing portal.
export function planForPrice(price: string | { id: string } | null | undefined): PlanId | null {
  const priceId = id(price);
  if (!priceId) return null;
  return (
    PLAN_IDS.find((plan) =>
      ['control', 'test'].some(
        (variant) =>
          process.env[`STRIPE_PRICE_${plan.toUpperCase()}${variant === 'test' ? '_TEST' : ''}`] ===
          priceId,
      ),
    ) ?? null
  );
}

const planTag = (metadata: Stripe.Metadata | null | undefined): PlanId | null =>
  isPlanId(metadata?.plan) ? metadata.plan : null;

// The plan this invoice bills for: its regular subscription line, not a proration for the old plan.
export function planFromInvoice(invoice: Stripe.Invoice): PlanId | null {
  for (const line of invoice.lines?.data ?? []) {
    const item = line.parent?.subscription_item_details;
    if (!item || item.proration) continue;
    const plan = planForPrice(line.pricing?.price_details?.price);
    if (plan) return plan;
  }
  return planTag(invoice.parent?.subscription_details?.metadata);
}

// Price IDs survive flag shutdown and portal changes; never re-evaluate a paid subscription.
export function variantFromInvoice(invoice: Stripe.Invoice): PricingVariant {
  for (const line of invoice.lines?.data ?? []) {
    if (!line.parent?.subscription_item_details || line.parent.subscription_item_details.proration)
      continue;
    const price = id(line.pricing?.price_details?.price);
    if (!price) continue;
    for (const variant of ['control', 'test'] as const) {
      if (
        PLAN_IDS.some(
          (plan) =>
            process.env[
              `STRIPE_PRICE_${plan.toUpperCase()}${variant === 'test' ? '_TEST' : ''}`
            ] === price,
        )
      )
        return variant;
    }
  }
  return invoice.parent?.subscription_details?.metadata?.pricing_variant === 'test'
    ? 'test'
    : 'control';
}

export function planFromSubscription(subscription: Stripe.Subscription): PlanId | null {
  for (const item of subscription.items?.data ?? []) {
    const plan = planForPrice(item.price);
    if (plan) return plan;
  }
  return planTag(subscription.metadata);
}

// Verifies the signature, then grants credits once per paid checkout session or monthly-plan invoice.
export async function handleStripeWebhook(rawBody: string, signature: string | null) {
  const client = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!client || !secret || !signature)
    throw new AppError('Webhook not configured', 400, 'no_stripe');
  const event = await client.webhooks.constructEventAsync(rawBody, signature, secret);

  const paidAt = Number.isFinite(event.created) ? new Date(event.created * 1000) : new Date();
  switch (event.type) {
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.completed':
      return onCheckoutCompleted(event.data.object, paidAt);
    case 'invoice.paid':
      return onInvoicePaid(event.data.object, paidAt);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return onSubscriptionChanged(event.data.object);
  }
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session, paidAt: Date) {
  const userId = session.client_reference_id;
  const customerId = id(session.customer);
  if (userId && customerId) {
    await db().user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }
  // Monthly-plan credits arrive with invoice.paid, once per billing cycle.
  if (session.payment_status !== 'paid') return;
  await linkGoogleCheckout(session.id, id(session.invoice));
  if (session.mode !== 'payment') {
    const invoiceId = id(session.invoice);
    const purchase = invoiceId
      ? await db().purchase.findUnique({ where: { stripeSessionId: invoiceId } })
      : null;
    if (purchase?.status === 'paid')
      await capturePurchase(purchase.id, false, { checkout: session });
    return;
  }

  const purchase = await db().purchase.findUnique({ where: { stripeSessionId: session.id } });
  if (!purchase) throw new Error(`unknown checkout session ${session.id}`);
  if (
    purchase.packId.startsWith('topup_') &&
    (session.amount_total !== purchase.amountCents ||
      session.currency !== purchase.currency ||
      session.client_reference_id !== purchase.userId)
  )
    throw new AppError('Paid top-up does not match the purchase', 400, 'purchase_mismatch');
  await grantCredits({
    userId: purchase.userId,
    amount: purchase.credits,
    key: `stripe:${session.id}`,
    reason: 'purchase',
    purchaseId: purchase.id,
  });
  await db().purchase.updateMany({
    where: { id: purchase.id, status: 'pending' },
    data: { status: 'paid', paidAt },
  });
  await db().purchase.updateMany({ where: { id: purchase.id, paidAt: null }, data: { paidAt } });
  await enqueueGooglePurchase(purchase.id);
  await capturePurchase(purchase.id, false, { checkout: session });
}

async function onInvoicePaid(invoice: Stripe.Invoice, eventAt: Date) {
  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : eventAt;
  const details = invoice.parent?.subscription_details;
  const userId = details?.metadata?.userId;
  const plan = planFromInvoice(invoice);
  if (!details || !userId || !plan) return;
  const variant = variantFromInvoice(invoice);
  const paidPlan = pricingFor(variant).plans[plan];
  const currency = invoice.currency === 'eur' ? 'eur' : 'usd';
  const purchase = await db().purchase.upsert({
    where: { stripeSessionId: invoice.id },
    // A nonempty no-op update lets Prisma use a database-native atomic upsert on replays.
    update: { stripeSessionId: invoice.id },
    create: {
      userId,
      stripeSessionId: invoice.id,
      packId: purchasePackId(plan, variant),
      credits: paidPlan.monthlyCredits,
      amountCents: invoice.amount_paid ?? unitAmountCents(plan, variant, currency),
      currency,
    },
  });
  await grantCredits({
    userId,
    amount: purchase.credits,
    key: `stripe:invoice:${invoice.id}`,
    reason: 'subscription',
    purchaseId: purchase.id,
  });
  await db().purchase.updateMany({
    where: { id: purchase.id, status: 'pending' },
    data: { status: 'paid', paidAt },
  });
  await db().purchase.updateMany({ where: { id: purchase.id, paidAt: null }, data: { paidAt } });
  await enqueueGooglePurchase(purchase.id);
  await capturePurchase(purchase.id, false, { invoice });
}

async function onSubscriptionChanged(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  const plan = planFromSubscription(subscription);
  if (!userId || !plan) return;
  await db().user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: id(subscription.customer),
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPlan: plan,
    },
  });
}

export async function getBillingStatus(userId: string) {
  const user = await db().user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true, subscriptionStatus: true, subscriptionPlan: true },
  });
  // Subscribers from before Creator and Scale have no stored plan: they are on Pro.
  const stored = user?.subscriptionPlan;
  const plan: PlanId | null = isActiveSubscription(user?.subscriptionStatus)
    ? isPlanId(stored)
      ? stored
      : 'pro'
    : null;
  return {
    plan,
    canManage: Boolean(user?.stripeCustomerId && process.env.STRIPE_SECRET_KEY),
  };
}

// The pack's price in USD at list, so EUR and USD orders can be compared in one revenue number.
function listRevenueUsd(purchase: { packId: string; credits: number }): number | null {
  const [plan] = purchase.packId.split(':');
  const variant = purchasedVariant(purchase.packId);
  if (plan?.startsWith('topup_')) {
    const subscriptionPlan = plan.slice('topup_'.length);
    if (isPlanId(subscriptionPlan))
      return (
        topupAmountCents(
          purchase.credits,
          topupPricing({ status: 'active', plan: subscriptionPlan, variant }),
        ) / 100
      );
  }
  if (plan === 'payg') return (purchase.credits * unitAmountCents('payg', variant)) / 100;
  return isPlanId(plan) ? unitAmountCents(plan, variant) / 100 : null;
}

async function purchaseCheckout(
  stripeId: string,
  paidInvoice?: Stripe.Invoice,
): Promise<Stripe.Checkout.Session | null> {
  const client = stripe();
  if (!client) return null;
  const options = { timeout: 5000, maxNetworkRetries: 0 };
  if (stripeId.startsWith('cs_')) return client.checkout.sessions.retrieve(stripeId, {}, options);
  if (!stripeId.startsWith('in_')) return null;
  const invoice = paidInvoice ?? (await client.invoices.retrieve(stripeId, {}, options));
  // Only the initial subscription payment belongs to the browser checkout.
  const subscription = id(invoice.parent?.subscription_details?.subscription);
  if (invoice.billing_reason !== 'subscription_create' || !subscription) return null;
  const sessions = await client.checkout.sessions.list({ subscription, limit: 1 }, options);
  const session = sessions.data.find((session) => id(session.invoice) === stripeId);
  // invoice.paid can precede Checkout attaching its invoice. Retry via the checkout webhook/recovery.
  if (!session) throw new Error('Checkout attribution not ready');
  return session;
}

export async function capturePurchase(
  purchaseId: string,
  hasDeferredDelivery = false,
  source: { checkout?: Stripe.Checkout.Session; invoice?: Stripe.Invoice } = {},
) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    const purchase = await db().purchase.findUniqueOrThrow({ where: { id: purchaseId } });
    // A signed replay can supply the real time; never invent it from mutable metadata updates.
    if (!purchase.paidAt || purchase.status !== 'paid') return;
    const user = await db().user.findUniqueOrThrow({ where: { id: purchase.userId } });
    const resolved =
      source.checkout ?? (await purchaseCheckout(purchase.stripeSessionId, source.invoice));
    const session = resolved?.client_reference_id === purchase.userId ? resolved : null;
    const touch = checkoutAttributionFromMetadata(session?.metadata);
    const country = session?.customer_details?.address?.country;
    const attributionProperties = {
      ...touch,
      has_ad_click_attribution: Boolean(touch.gclid || touch.gbraid || touch.wbraid),
      ...Object.fromEntries(
        Object.entries(touch)
          .filter(([key]) => key.startsWith('utm_'))
          .map(([key, value]) => [`ft_${key}`, value]),
      ),
      ...(touch.landing_path ? { ft_landing_path: touch.landing_path } : {}),
      ...(touch.referrer_host
        ? { ft_referrer: touch.referrer_host, $referring_domain: touch.referrer_host }
        : {}),
      ...(touch.posthog_session_id ? { $session_id: touch.posthog_session_id } : {}),
      ...(country && /^[A-Z]{2}$/.test(country)
        ? { $geoip_country_code: country, country, geo_country: country }
        : {}),
      ...(session?.metadata?.ui_locale ? { ui_locale: session.metadata.ui_locale } : {}),
    };
    const [first] = await db().$queryRaw<{ id: string }[]>`
      SELECT id FROM "Purchase" WHERE "userId" = ${purchase.userId} AND status = 'paid'
      ORDER BY COALESCE("paidAt", "createdAt"), id LIMIT 1`;
    for (const event of ['purchase', 'purchase_completed'] as const)
      await captureServer(
        event,
        purchase.id,
        {
          userId: purchase.userId,
          previewId: null,
          source: 'web',
          hasDeferredDelivery,
          distinctId: touch.posthog_distinct_id,
          attribution: pickAttribution(user),
        },
        {
          ...attributionProperties,
          stripe_session_id: session?.id ?? purchase.stripeSessionId,
          plan: purchase.packId.split(':')[0],
          pricing_subject: await pricingSubject(purchase.userId),
          pricing_variant: purchasedVariant(purchase.packId),
          [`$feature/${PRICING_FLAG}`]: purchasedVariant(purchase.packId),
          revenue: purchase.amountCents / 100,
          order_id: purchase.id,
          pack_id: purchase.packId,
          credits: purchase.credits,
          amount: purchase.amountCents / 100,
          currency: purchase.currency.toUpperCase(),
          list_revenue_usd: listRevenueUsd(purchase),
          is_first_purchase: first?.id === purchase.id,
          payment_provider: 'stripe',
        },
        undefined,
        purchase.paidAt,
      );
  } catch {
    reportError(new Error('Unable to record paid purchase analytics'), { component: 'analytics' });
  }
}

/** Owner-scoped, DB-confirmed checkout result. Never trust success query parameters. */
export async function confirmedPurchase(
  userId: string,
  sessionId: string,
  hasMeasurementConsent = false,
  hasAdvertisingConsent = false,
) {
  let purchase = await db().purchase.findFirst({
    where: { userId, stripeSessionId: sessionId, status: 'paid' },
  });
  if (
    !purchase &&
    sessionId.startsWith('cs_') &&
    stripe() &&
    !(await db().purchase.findUnique({
      where: { stripeSessionId: sessionId },
      select: { id: true },
    }))
  ) {
    const session = await stripe()?.checkout.sessions.retrieve(sessionId);
    if (
      session?.client_reference_id === userId &&
      session.mode === 'subscription' &&
      session.payment_status === 'paid'
    ) {
      const invoiceId = id(session.invoice);
      if (invoiceId)
        purchase = await db().purchase.findFirst({
          where: { userId, stripeSessionId: invoiceId, status: 'paid' },
        });
    }
  }
  if (!purchase) return null;
  const posthog = hasMeasurementConsent
    ? await db().posthogDelivery.findUnique({
        where: { id: eventUuid(`purchase_completed:${purchase.id}`) },
        select: { id: true, distinctId: true, occurredAt: true, properties: true },
      })
    : null;
  const properties = posthog?.properties as Record<string, unknown> | undefined;
  return {
    posthog:
      posthog && typeof properties?.$session_id === 'string'
        ? {
            ...posthog,
            properties: sanitizeProperties(properties ?? {}, hasAdvertisingConsent),
            occurredAt: posthog.occurredAt.toISOString(),
          }
        : null,
    server_managed: Boolean(
      (await db().googlePurchaseDelivery.findUnique({
        where: { purchaseId: purchase.id },
        select: { purchaseId: true },
      })) ||
        (isGoogleMeasurementConfigured() &&
          (await db().googleCheckout.findFirst({
            where: {
              userId,
              revokedAt: null,
              expiresAt: { gte: purchase.paidAt ?? purchase.updatedAt },
              clientId: { not: '' },
              sessionId: { not: '' },
              OR: [{ id: purchase.stripeSessionId }, { invoiceId: purchase.stripeSessionId }],
            },
            select: { id: true },
          }))),
    ),
    pricing_variant: purchasedVariant(purchase.packId),
    transaction_id: sessionId,
    issued_credits: purchase.credits,
    value: purchase.amountCents / 100,
    currency: purchase.currency.toUpperCase(),
    items: [{ item_id: purchase.packId, quantity: 1, price: purchase.amountCents / 100 }],
  };
}
