import { getLocale, getTranslations } from 'next-intl/server';
import { AnalyticsTable } from '@/components/admin-analytics/table';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buyersData } from '@/lib/admin-analytics/inventory';

export async function BuyersTable({ labels }: { labels: Record<string, string> }) {
  const t = await getTranslations('AdminInventory');
  const locale = await getLocale();
  const data = await buyersData()
    .then((buyers) => ({ buyers, error: null }))
    .catch((error: unknown) => ({
      buyers: null,
      error:
        error instanceof Error && error.message === 'analyticsRowLimit'
          ? 'analyticsRowLimit'
          : 'postgresUnavailable',
    }));
  if (!data.buyers)
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('buyers')}</CardTitle>
          <CardDescription role="alert">
            {labels[data.error ?? 'postgresUnavailable']}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  const columns = [
    'buyerEmail',
    'buyerPurchases',
    'buyerPurchased',
    'buyerGifted',
    'buyerOther',
    'buyerUsed',
    'buyerRefunded',
    'buyerRemaining',
    'buyerPaid',
    'buyerUnknownAmounts',
    'buyerFirst',
    'buyerLast',
  ] as const;
  const inventoryLabels = Object.fromEntries(columns.map((key) => [key, t(key)]));
  return (
    <AnalyticsTable
      initialSort={{ key: 'buyerLast', direction: -1 }}
      labels={{ ...labels, ...inventoryLabels, buyers: t('buyers'), buyersNote: t('buyersNote') }}
      table={{
        key: 'buyers',
        columns: [...columns],
        source: 'postgres',
        quality: 'measured',
        note: 'buyersNote',
        rows: data.buyers.map((buyer) => ({
          buyerId: buyer.id,
          buyerEmail: buyer.email,
          buyerPurchases: buyer.purchases,
          buyerPurchased: buyer.purchased,
          buyerGifted: buyer.gifted,
          buyerOther: buyer.other,
          buyerUsed: buyer.used,
          buyerRefunded: buyer.refunded,
          buyerRemaining: buyer.remaining,
          buyerPaid:
            Object.entries(buyer.amounts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([currency, cents]) =>
                new Intl.NumberFormat(locale, {
                  style: 'currency',
                  currency,
                  currencyDisplay: 'code',
                }).format(cents / 100),
              )
              .join(' + ') || null,
          buyerUnknownAmounts: buyer.unknownAmounts,
          buyerFirst: buyer.firstPurchase.replace('T', ' ').replace('.000Z', ' UTC'),
          buyerLast: buyer.lastPurchase.replace('T', ' ').replace('.000Z', ' UTC'),
        })),
      }}
    />
  );
}
