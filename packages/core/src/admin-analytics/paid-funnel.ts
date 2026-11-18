import { isPlanId } from '@easyrender/harness';
import { channel, type DataTable, type Range, type Row } from './helpers';

type User = { id: string; createdAt: Date };
type Attribution = {
  id: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
};
type Preview = { userId: string | null; createdAt: Date; previewCompletedAt: Date | null };
type Checkout = { userId: string; createdAt: Date; packId: string };
type Payment = { userId: string | null; at: string; gross: number };

/** Ordered account outcomes in one signup cohort; never joins anonymous visits to purchasers. */
export function paidSignupFunnel(
  users: User[],
  attribution: Attribution[],
  previews: Preview[],
  checkouts: Checkout[],
  payments: Payment[],
  range: Pick<Range, 'start' | 'end'>,
): DataTable {
  const start = Date.parse(range.start),
    end = Date.parse(range.end);
  const attrs = new Map(attribution.map((a) => [a.id, a]));
  const members = new Map(
    users
      .filter(
        (u) =>
          +u.createdAt >= start &&
          +u.createdAt < end &&
          channel(attrs.get(u.id) ?? {}) === 'paidSearch',
      )
      .map((user) => [
        user.id,
        {
          user,
          campaign: attrs.get(user.id)?.utm_campaign?.trim().toLowerCase() || 'unknown',
          preview: Infinity,
          checkout: Infinity,
          hasPayment: false,
        },
      ]),
  );
  for (const preview of previews) {
    const member = preview.userId ? members.get(preview.userId) : undefined;
    const at = preview.previewCompletedAt;
    if (member && at && +at >= +preview.createdAt && +at < end)
      member.preview = Math.min(member.preview, +at);
  }
  for (const checkout of checkouts) {
    const member = members.get(checkout.userId);
    // Subscription purchase rows are invoices, not evidence of starting Checkout.
    const pack = checkout.packId.replace(/:test$/, '');
    const isCreditCheckout =
      pack === 'payg' || (pack.startsWith('topup_') && isPlanId(pack.slice(6)));
    if (
      member &&
      isCreditCheckout &&
      +checkout.createdAt >= Math.max(+member.user.createdAt, member.preview) &&
      +checkout.createdAt < end
    )
      member.checkout = Math.min(member.checkout, +checkout.createdAt);
  }
  for (const payment of payments) {
    const member = payment.userId ? members.get(payment.userId) : undefined;
    const at = Date.parse(payment.at);
    if (member && payment.gross > 0 && at >= member.checkout && at < end) member.hasPayment = true;
  }
  const rows = new Map<string, Row>();
  for (const member of members.values()) {
    const row = rows.get(member.campaign) ?? {
      campaign: member.campaign,
      signups: 0,
      paidPreviewAccounts: 0,
      creditCheckoutAccounts: 0,
      previewWithoutCheckout: 0,
      checkoutWithoutPayment: 0,
      paidAfterCheckout: 0,
    };
    const hasPreview = Number.isFinite(member.preview),
      hasCheckout = Number.isFinite(member.checkout);
    for (const [key, value] of Object.entries({
      signups: 1,
      paidPreviewAccounts: Number(hasPreview),
      creditCheckoutAccounts: Number(hasCheckout),
      previewWithoutCheckout: Number(hasPreview && !hasCheckout),
      checkoutWithoutPayment: Number(hasCheckout && !member.hasPayment),
      paidAfterCheckout: Number(member.hasPayment),
    }))
      row[key] = Number(row[key]) + value;
    rows.set(member.campaign, row);
  }
  return {
    key: 'paidSignupFunnel',
    columns: [
      'campaign',
      'signups',
      'paidPreviewAccounts',
      'creditCheckoutAccounts',
      'previewWithoutCheckout',
      'checkoutWithoutPayment',
      'paidAfterCheckout',
    ],
    rows: [...rows.values()],
    source: 'mixed',
    quality: 'proxy',
    note: 'paidSignupFunnelScope',
  };
}
