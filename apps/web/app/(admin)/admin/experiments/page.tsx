import { firstModelReport } from '@easyrender/core';
import { RENDER_COST_USD, SHEET_COST_USD } from '@easyrender/harness';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { FirstModelControls } from '@/components/first-model-controls';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireAdmin } from '@/lib/admin-analytics/auth';
import en from '@/messages/en.json';
import es from '@/messages/es.json';

export const dynamic = 'force-dynamic';
export default async function ExperimentsPage() {
  await requireAdmin();
  const locale = (await getLocale()) === 'es' ? 'es' : 'en';
  const t = (locale === 'es' ? es : en).FirstModelAdmin;
  const report = await firstModelReport();
  const campaign = report.campaign;
  const hasEnded = Boolean(
    campaign && (campaign.endsAt <= new Date() || campaign.enrolled >= campaign.maxOffers * 2),
  );
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return (
    <div className="space-y-6" lang={locale}>
      <header className="space-y-3">
        <Button variant="ghost" asChild>
          <Link href="/admin/analytics">← {t.back}</Link>
        </Button>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-muted-foreground">{t.description}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>
            {t.status}:{' '}
            {!campaign ? t.inactive : hasEnded ? t.ended : campaign.isActive ? t.active : t.paused}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaign && (
            <p className="text-sm text-muted-foreground">
              {t.end}: {campaign.endsAt.toLocaleDateString(locale)}
            </p>
          )}
          <FirstModelControls
            campaign={
              campaign
                ? { isActive: campaign.isActive, maxOffers: campaign.maxOffers, hasEnded }
                : null
            }
            unitCostUsd={RENDER_COST_USD + SHEET_COST_USD}
            copy={t}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.cohorts}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t.caveat}</p>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  'window',
                  'variant',
                  'matureVisitors',
                  'signups',
                  'firstModels',
                  'secondModels',
                  'payers',
                  'conversion',
                ].map((key) => (
                  <TableHead key={key}>{t[key as keyof typeof t]}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.windows
                .filter((row) => row.pricingVariant === 'all')
                .map((row) => (
                  <TableRow key={`${row.days}-${row.variant}`}>
                    <TableCell>{t.days.replace('{days}', String(row.days))}</TableCell>
                    <TableCell>{t[row.variant]}</TableCell>
                    <TableCell>{row.matureVisitors}</TableCell>
                    <TableCell>{row.signups}</TableCell>
                    <TableCell>{row.firstModels}</TableCell>
                    <TableCell>{row.secondModels}</TableCell>
                    <TableCell>{row.payers}</TableCell>
                    <TableCell>
                      {row.matureVisitors
                        ? `${format.format((row.payers / row.matureVisitors) * 100)}%`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <p className="text-sm text-muted-foreground">{t.pricing}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.economics}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-2">
            {report.arms.map((arm) => (
              <section key={arm.variant} className="space-y-3">
                <h2 className="font-medium">{t[arm.variant]}</h2>
                <dl className="space-y-2 text-sm">
                  {[
                    [t.enrolled, arm.enrolled],
                    [t.signups, arm.signups],
                    [t.granted, arm.granted],
                    [t.providerCost, format.format(arm.recordedProviderCostUsd)],
                    [
                      t.net,
                      arm.netBeforeFeesUsdEstimate === null
                        ? t.unknown
                        : format.format(arm.netBeforeFeesUsdEstimate),
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-muted-foreground">{t.revenue}</dt>
                    <dd>
                      {Object.entries(arm.revenueCentsByCurrency)
                        .map(
                          ([currency, cents]) =>
                            `${currency.toUpperCase()} ${format.format(cents / 100)}`,
                        )
                        .join(' · ') || '—'}
                    </dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{t.costCaveat}</p>
          <Button variant="outline" asChild>
            <a href="/api/admin/experiments/first-model">{t.download}</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
