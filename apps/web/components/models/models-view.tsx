import { BUILD_MODEL, FINAL_SHEET_MODEL, RENDER_CREDITS, SHEET_MODEL } from '@easyrender/harness';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { QualityEvidence } from '@/components/quality-evidence';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Locale } from '@/i18n/config';
import { formatCount, formatMoney } from '@/lib/price-format';
import { currentPricing } from '@/lib/pricing';
import { ROUTES } from '@/lib/seo/routes';

// The model ids come from the harness, so this page cannot name a model the pipeline does not run.
// A sheet model id is the path segment of its model; TRELLIS is the Replicate model name.
const modelId = (path: string) => path.replace('/models/', '').replace('/predictions', '');

/** The models page of one language: the two steps, their settings and what each costs. */
export async function ModelsView({ locale }: { locale: Locale }) {
  const t = await getTranslations('Models');
  const quality = await getTranslations('LandingIntent');
  const qualityCopy = {
    title: quality('qualityTitle'),
    body: quality('qualityBody'),
    upload: quality('upload'),
    sample: quality('sample'),
    evals: quality('evals'),
  };
  const { creditPrice, currency } = await currentPricing();
  const rows = [
    { key: 'sheet', credits: 0 },
    { key: 'build', credits: RENDER_CREDITS },
    { key: 'total', credits: RENDER_CREDITS, isTotal: true },
  ] as const;

  const steps = [
    {
      key: 'sheet',
      name: SHEET_MODEL.name,
      id: modelId(SHEET_MODEL.path),
      settings: [t('sheet.settings.output'), t('sheet.settings.prompt')],
    },
    {
      key: 'final',
      name: FINAL_SHEET_MODEL.name,
      id: modelId(FINAL_SHEET_MODEL.path),
      settings: [t('final.settings.output'), t('final.settings.prompt')],
    },
    {
      key: 'build',
      name: 'TRELLIS',
      id: BUILD_MODEL.name,
      settings: [
        t('build.settings.texture', { texture: BUILD_MODEL.input.texture_size }),
        t('build.settings.simplify', { simplify: BUILD_MODEL.input.mesh_simplify }),
        t('build.settings.seed'),
      ],
    },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-3">
        <Badge variant="outline">{t('eyebrow')}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground text-pretty">{t('description')}</p>
        <p className="text-sm text-muted-foreground">{t('provider')}</p>
      </header>
      <QualityEvidence locale={locale} copy={qualityCopy} showEvals />

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <Card key={step.key}>
            <CardHeader>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('stepLabel', { number: index + 1 })} · {t(`${step.key}.title`)}
              </p>
              <CardTitle className="text-xl">{step.name}</CardTitle>
              <p className="font-mono text-xs text-muted-foreground">{step.id}</p>
              <CardDescription className="text-pretty">{t(`${step.key}.role`)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm font-medium">{t('settingsTitle')}</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {step.settings.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="mt-12 space-y-4" aria-labelledby="models-pricing">
        <h2 id="models-pricing" className="text-2xl font-semibold tracking-tight">
          {t('pricing.title')}
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('pricing.step')}</TableHead>
              <TableHead className="text-right">{t('pricing.credits')}</TableHead>
              <TableHead className="text-right">{t('pricing.price')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className={'isTotal' in row ? 'font-medium' : undefined}>
                  {t(`pricing.${row.key}`)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCount(locale, row.credits)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(locale, row.credits * creditPrice, currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground text-pretty">
          {t('pricing.note', { unit: formatMoney(locale, creditPrice, currency) })}
        </p>
      </section>

      <section className="mt-12 space-y-2" aria-labelledby="models-change">
        <h2 id="models-change" className="text-2xl font-semibold tracking-tight">
          {t('change.title')}
        </h2>
        <p className="max-w-2xl text-muted-foreground text-pretty">{t('change.body')}</p>
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href={ROUTES.evals.paths[locale]}>
            {t('cta')}
            <ArrowRight />
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href={ROUTES.home.paths[locale]}>{t('home')}</Link>
        </Button>
      </div>
    </div>
  );
}
