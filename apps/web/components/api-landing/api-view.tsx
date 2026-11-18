import { ArrowRight, Box, ChevronDownIcon, Code2, Upload } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CodeSnippet } from '@/components/code-snippet';
import { IntegrationCosts } from '@/components/integrations/costs';
import { IntegrationLink } from '@/components/integrations/link';
import { IntegrationResult } from '@/components/integrations/result';
import { Pricing, Section } from '@/components/landing';
import { ResourceLinks } from '@/components/resource-links';
import { StudioHero } from '@/components/studio/hero';
import { StudioClosing, StudioCompatibility } from '@/components/studio/proof';
import { StudioShell } from '@/components/studio/shell';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';
import { localizedAuthPath } from '@/lib/app-locale';
import { ROUTES } from '@/lib/seo/routes';
import { API_EXAMPLES, API_SETUP } from './examples';

const USE_CASES = [
  { key: 'catalog', icon: Box },
  { key: 'app', icon: Upload },
  { key: 'web', icon: Code2 },
] as const;
const STEPS = ['photo', 'review', 'download'] as const;
const FAQ_KEYS = ['input', 'auth', 'cost', 'errors', 'webhooks', 'scope'] as const;

export async function apiFaqItems(locale: Locale) {
  const t = await getTranslations({ locale, namespace: 'ApiLanding.faq.items' });
  return FAQ_KEYS.map((key) => ({ question: t(`${key}.q`), answer: t(`${key}.a`) }));
}

export async function ApiView({ locale }: { locale: Locale }) {
  const [t, user, items] = await Promise.all([
    getTranslations({ locale, namespace: 'ApiLanding' }),
    currentUser().catch(() => null),
    apiFaqItems(locale),
  ]);
  const examples = await getTranslations({ locale, namespace: 'IntegrationLanding.examples' });
  const accountHref = user
    ? '/connectors'
    : `${localizedAuthPath(locale, '/sign-up')}?next=%2Fconnectors`;
  const accountLabel = t(user ? 'connect.cta' : 'connect.signup');
  const copyLabels = {
    copyLabel: t('examples.copy'),
    copiedLabel: t('examples.copied'),
    errorLabel: t('examples.copyError'),
  };

  return (
    <StudioShell>
      <StudioHero
        ctaHref="#connect"
        copy={{
          title: t('hero.title'),
          subtitle: t('hero.subtitle'),
          cta: t('hero.cta'),
          note: t('hero.note'),
        }}
      />
      <StudioCompatibility />
      <IntegrationResult locale={locale} kind="api" />
      <Section title={t('intro.title')} description={t('intro.description')}>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pb-8 text-sm">
          <p className="text-muted-foreground">{t('formatsLabel')}</p>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {(['auth', 'upload', 'status', 'output'] as const).map((key) => (
              <li key={key}>{t(`formats.${key}`)}</li>
            ))}
          </ul>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {USE_CASES.map(({ key, icon: Icon }) => (
            <div key={key} className="space-y-3 border-t pt-6">
              <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-xl font-medium">{t(`intro.${key}.title`)}</h3>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                {t(`intro.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </Section>
      <IntegrationCosts locale={locale} kind="api" />
      <Section
        id="how-it-works"
        title={t('workflow.title')}
        description={t('workflow.description')}
      >
        <ol className="grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step} className="space-y-3">
              <span className="font-mono text-xs text-muted-foreground" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="text-xl font-medium">{t(`workflow.${step}.title`)}</h3>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                {t(`workflow.${step}.body`)}
              </p>
            </li>
          ))}
        </ol>
      </Section>
      <Section id="connect" title={t('connect.title')} description={t('connect.description')}>
        <div className="grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-5">
            <h3 className="text-xl font-medium">{t('connect.accountTitle')}</h3>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {t('connect.accountBody')}
            </p>
            <Button asChild size="lg">
              <IntegrationLink channel="api" action="setup" href={accountHref}>
                {accountLabel} <ArrowRight aria-hidden="true" />
              </IntegrationLink>
            </Button>
            <Button asChild variant="outline">
              <Link href="#examples">{t('connect.curlLink')}</Link>
            </Button>
            <div className="space-y-2 pt-4">
              <p className="text-sm text-muted-foreground">{t('connect.mcpTitle')}</p>
              <Link
                className="text-sm underline underline-offset-4"
                href={ROUTES.mcp.paths[locale]}
              >
                {t('connect.mcpLink')}
              </Link>
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            <CodeSnippet code={API_SETUP} label={t('connect.setupLabel')} {...copyLabels} />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('connect.setupNote')}
            </p>
          </div>
        </div>
      </Section>
      <Section id="examples" title={t('examples.title')} description={t('examples.description')}>
        <ol className="space-y-10">
          {API_EXAMPLES.map(({ key, code }) => (
            <li
              key={key}
              className="grid items-start gap-6 border-t pt-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10"
            >
              <div className="space-y-3">
                <h3 className="text-xl font-medium">{t(`examples.${key}.title`)}</h3>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  {t(`examples.${key}.body`)}
                </p>
              </div>
              <CodeSnippet code={code} label={t(`examples.${key}.label`)} {...copyLabels} />
            </li>
          ))}
        </ol>
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {t('examples.polling')}
        </p>
      </Section>
      <Section id="runnable-examples" title={examples('title')} description={examples('body')}>
        <div className="flex flex-wrap justify-center gap-3">
          {(['python', 'typescript', 'reference'] as const).map((kind) => (
            <Button key={kind} variant="outline" asChild>
              <IntegrationLink
                channel="api"
                action={kind === 'reference' ? 'reference' : `example_${kind}`}
                href={
                  kind === 'reference'
                    ? '/api/openapi.json'
                    : `https://github.com/easyrenderai/easyrender.ai/blob/main/examples/rest/${kind === 'python' ? 'render.py' : 'render.ts'}`
                }
              >
                {examples(kind)} <ArrowRight aria-hidden="true" />
              </IntegrationLink>
            </Button>
          ))}
        </div>
      </Section>
      <Pricing />
      <Section id="faq" title={t('faq.title')} narrow>
        <div className="sec__column">
          {items.map((item) => (
            <details key={item.question} className="group border-b last:border-b-0">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-md py-5 text-left font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <h3 className="text-base font-medium">{item.question}</h3>
                <ChevronDownIcon
                  className="size-4 shrink-0 translate-y-1 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </Section>
      <ResourceLinks locale={locale} context="api" />
      <StudioClosing title={t('closing.title')} label={accountLabel} href={accountHref} />
    </StudioShell>
  );
}
