import { expect, it } from 'vitest';
import { paidSignupFunnel } from './paid-funnel';

const date = (day: number) => new Date(`2026-11-${String(day).padStart(2, '0')}T12:00:00Z`);
const range = { start: date(2).toISOString(), end: date(10).toISOString() };
const users = [
  { id: 'a', createdAt: date(3) },
  { id: 'b', createdAt: date(3) },
  { id: 'old', createdAt: date(1) },
];
const attribution = users.map((u) => ({
  id: u.id,
  utm_source: 'google',
  utm_medium: 'cpc',
  utm_campaign: 'niche',
}));
const preview = (userId: string, at = date(4)) => ({
  userId,
  createdAt: date(2),
  previewCompletedAt: at,
});
const checkout = (userId: string, at = date(5), packId = 'payg') => ({
  userId,
  createdAt: at,
  packId,
});
const payment = (userId: string, at = date(6), gross = 10) => ({
  userId,
  at: at.toISOString(),
  gross,
});
it('counts distinct new paid-search accounts through ordered preview, credit checkout and payment steps', () => {
  const table = paidSignupFunnel(
    users,
    attribution,
    [preview('a'), preview('a'), preview('b'), preview('old')],
    [checkout('a'), checkout('a'), checkout('old')],
    [payment('a'), payment('a')],
    range,
  );
  expect(table.rows).toEqual([
    {
      campaign: 'niche',
      signups: 2,
      paidPreviewAccounts: 2,
      creditCheckoutAccounts: 1,
      previewWithoutCheckout: 1,
      checkoutWithoutPayment: 0,
      paidAfterCheckout: 1,
    },
  ]);
});
it('does not count subscription invoices, later outcomes or payments before checkout as conversions', () => {
  const table = paidSignupFunnel(
    users,
    attribution,
    [preview('a'), preview('b')],
    [checkout('a'), checkout('b', date(5), 'pro'), checkout('b', date(11))],
    [payment('a', date(4)), payment('a', date(11)), payment('a', date(6), 0)],
    range,
  );
  expect(table.rows[0]).toMatchObject({
    creditCheckoutAccounts: 1,
    previewWithoutCheckout: 1,
    checkoutWithoutPayment: 1,
    paidAfterCheckout: 0,
  });
});
it('keeps excluded accounts out and accepts a claimed preview completed before signup', () => {
  const attrs = [...attribution, { id: 'organic', utm_source: 'google', utm_medium: 'organic' }];
  const table = paidSignupFunnel(
    [...users, { id: 'organic', createdAt: date(3) }],
    attrs,
    [preview('a', date(2)), preview('b', date(11))],
    [checkout('a', date(3), 'topup_pro')],
    [payment('a')],
    range,
  );
  expect(table.rows[0]).toMatchObject({
    signups: 2,
    paidPreviewAccounts: 1,
    creditCheckoutAccounts: 1,
    paidAfterCheckout: 1,
  });
  expect(
    paidSignupFunnel([], attrs, [preview('a')], [checkout('a')], [payment('a')], range).rows,
  ).toEqual([]);
});

it('recognizes the actual pricing experiment suffix and every supported top-up plan', () => {
  for (const packId of ['payg:test', 'topup_creator', 'topup_pro:test', 'topup_scale:test']) {
    expect(
      paidSignupFunnel(
        users,
        attribution,
        [preview('a')],
        [checkout('a', date(5), packId)],
        [],
        range,
      ).rows[0],
    ).toMatchObject({ creditCheckoutAccounts: 1 });
  }
  for (const packId of ['pro:test', 'payg__anything', 'payg:other', 'topup_unknown']) {
    expect(
      paidSignupFunnel(
        users,
        attribution,
        [preview('a')],
        [checkout('a', date(5), packId)],
        [],
        range,
      ).rows[0],
    ).toMatchObject({ creditCheckoutAccounts: 0 });
  }
});
