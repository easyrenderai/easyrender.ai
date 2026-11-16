import { LIMITS } from '@easyrender/harness';
import { ArrowRight, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { QualityEvidence } from '@/components/quality-evidence';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { Locale } from '@/i18n/config';
import { EVAL_CRITERIA, listRuns, runPassRate } from '@/lib/evals';
import { ROUTES } from '@/lib/seo/routes';

const DATE_FORMAT = { year: 'numeric', month: 'long', day: 'numeric' } as const;

/** The evals page of one language: what is checked, what a run scores, and the runs so far. */
export async function EvalsView({ locale }: { locale: Locale }) {
  const [t, format] = await Promise.all([getTranslations('Evals'), getFormatter()]);
  const runs = listRuns();
  const quality = await getTranslations('LandingIntent');
  const qualityCopy = {
    title: quality('qualityTitle'),
    body: quality('qualityBody'),
    upload: quality('upload'),
    sample: quality('sample'),
    evals: quality('evals'),
  };

  // The numbers are the live guardrail limits, so this list cannot drift from what runs.
  const checks = [
    {
      key: 'photo',
      values: {
        min: LIMITS.minPhotoSide,
        max: format.number(LIMITS.maxPhotoSide),
        aspect: LIMITS.maxAspect,
      },
    },
    {
      key: 'sheet',
      values: {
        side: LIMITS.minSheetSide,
        cells: 9 - LIMITS.maxEmptyCells,
        repeats: LIMITS.maxDuplicateViews,
      },
    },
    { key: 'file', values: { kb: Math.round(LIMITS.minGlbBytes / 1000) } },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-3">
        <Badge variant="outline">{t('eyebrow')}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground text-pretty">{t('description')}</p>
      </header>
      <QualityEvidence locale={locale} copy={qualityCopy} />

      <section className="mt-12 space-y-4" aria-labelledby="evals-results">
        <h2 id="evals-results" className="text-2xl font-semibold tracking-tight">
          {t('results.title')}
        </h2>
        {runs.length === 0 ? (
          <Alert>
            <FlaskConical />
            <AlertTitle>{t('results.emptyTitle')}</AlertTitle>
            <AlertDescription>{t('results.emptyBody')}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {runs.map((run) => {
              const rate = runPassRate(run);
              return (
                <Card key={run.id}>
                  <CardHeader>
                    <CardTitle>
                      <time dateTime={run.date}>
                        {format.dateTime(new Date(run.date), DATE_FORMAT)}
                      </time>
                    </CardTitle>
                    <CardDescription>
                      {t('results.photos', { photos: run.photos })} ·{' '}
                      <span className="font-mono text-xs">
                        {t('results.models', { sheet: run.sheetModel, build: run.buildModel })}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">{t('results.overall')}</span>
                        <span className="tabular-nums">
                          {format.number(rate, { style: 'percent', maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <Progress value={rate * 100} />
                    </div>
                    <ul className="space-y-1 text-sm">
                      {EVAL_CRITERIA.map(({ id }) => (
                        <li key={id} className="flex items-baseline justify-between gap-4">
                          <span className="text-muted-foreground">{t(`criteria.${id}.title`)}</span>
                          <span className="tabular-nums">
                            {t('results.passed', run.criteria[id])}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {run.reportUrl ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={run.reportUrl} rel="noopener">
                          {t('results.report')}
                          <ArrowRight />
                        </a>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12 space-y-4" aria-labelledby="evals-criteria">
        <div className="space-y-2">
          <h2 id="evals-criteria" className="text-2xl font-semibold tracking-tight">
            {t('criteria.title')}
          </h2>
          <p className="max-w-2xl text-muted-foreground text-pretty">{t('criteria.description')}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {EVAL_CRITERIA.map(({ id, method }) => (
            <Card key={id}>
              <CardHeader>
                <Badge variant="secondary" className="w-fit">
                  {t(`criteria.methods.${method}`)}
                </Badge>
                <CardTitle>{t(`criteria.${id}.title`)}</CardTitle>
                <CardDescription className="text-pretty">
                  {t(`criteria.${id}.description`)}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12 space-y-4" aria-labelledby="evals-checks">
        <div className="space-y-2">
          <h2 id="evals-checks" className="text-2xl font-semibold tracking-tight">
            {t('checks.title')}
          </h2>
          <p className="max-w-2xl text-muted-foreground text-pretty">{t('checks.description')}</p>
        </div>
        <ul className="space-y-3 text-sm text-pretty">
          {checks.map((check) => (
            <li key={check.key} className="rounded-lg border p-4">
              {t(`checks.${check.key}`, check.values)}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Button asChild>
          <Link href={ROUTES.models.paths[locale]}>
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
