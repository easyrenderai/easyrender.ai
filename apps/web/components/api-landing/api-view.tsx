import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BlogModel } from '@/components/blog/blog-model';
import { CodeSnippet } from '@/components/code-snippet';
import { FaqSection } from '@/components/faq-section';
import { IntegrationCosts } from '@/components/integrations/costs';
import { IntegrationLink } from '@/components/integrations/link';
import { Section } from '@/components/landing';
import { ResourceLinks } from '@/components/resource-links';
import { AmbientObject } from '@/components/studio/ambient-object';
import { StudioClosing } from '@/components/studio/proof';
import { StudioShell } from '@/components/studio/shell';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';
import { localizedAuthPath } from '@/lib/app-locale';
import { TABLE_EXAMPLE } from '@/lib/marketing-examples';
import { ROUTES } from '@/lib/seo/routes';
import { API_EXAMPLES, API_SETUP } from './examples';

// The first request: the call that uploads a photo and returns the render to follow.
const [FIRST_REQUEST, ...NEXT_REQUESTS] = API_EXAMPLES;
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
  const result = await getTranslations({ locale, namespace: 'IntegrationLanding.result' });
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
      {/* The page answers one question: how do I call this from my code. The key and the first
          request are the first thing on it. */}
      <section
        id="connect"
        aria-labelledby="api-hero-title"
        className="relative isolate flex min-h-[calc(100svh-3.5rem)] w-full scroll-mt-20 items-center px-4 py-14 sm:px-6"
      >
        <AmbientObject id="lamp" className="lg:[--ambient-x:2%]" />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div className="min-w-0 space-y-6">
            <h1
              id="api-hero-title"
              className="text-4xl font-medium tracking-tight text-balance sm:text-5xl"
            >
              {t('hero.title')}
            </h1>
            <p className="hero__lead">{t('hero.subtitle')}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <IntegrationLink channel="api" action="setup" href={accountHref}>
                  {accountLabel} <ArrowRight aria-hidden="true" />
                </IntegrationLink>
              </Button>
              <Button asChild size="lg" variant="outline">
                <IntegrationLink channel="api" action="reference" href="/api/openapi.json">
                  {examples('reference')}
                </IntegrationLink>
              </Button>
            </div>
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
              {t('connect.setupNote')}
            </p>
          </div>
          <div className="min-w-0 space-y-4">
            <CodeSnippet code={API_SETUP} label={t('connect.setupLabel')} {...copyLabels} />
            <CodeSnippet
              code={FIRST_REQUEST.code}
              label={t(`examples.${FIRST_REQUEST.key}.label`)}
              {...copyLabels}
            />
            {/* What the requests end in: an existing public render, not a new generation. */}
            <figure className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <div className="w-32 shrink-0 sm:w-48">
                <BlogModel
                  src={TABLE_EXAMPLE.model}
                  alt={result('model.alt')}
                  poster={{ src: TABLE_EXAMPLE.photo, width: 1000, height: 1000 }}
                  orbit="30deg 75deg auto"
                  hint={result('model.hint')}
                />
              </div>
              <figcaption className="min-w-0 space-y-1.5">
                <p className="font-mono text-xs">product.glb</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {result('model.body')}
                </p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <Section
        id="how-it-works"
        title={t('examples.title')}
        description={t('examples.description')}
      >
        <ol className="space-y-10">
          {NEXT_REQUESTS.map(({ key, code }) => (
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
        <div className="flex flex-wrap gap-3 pt-8">
          {(['python', 'typescript'] as const).map((kind) => (
            <Button key={kind} variant="outline" asChild>
              <IntegrationLink
                channel="api"
                action={`example_${kind}`}
                href={`https://github.com/easyrenderai/easyrender.ai/blob/main/examples/rest/${kind === 'python' ? 'render.py' : 'render.ts'}`}
              >
                {examples(kind)} <ArrowRight aria-hidden="true" />
              </IntegrationLink>
            </Button>
          ))}
        </div>
      </Section>
      <IntegrationCosts locale={locale} kind="api" />
      <FaqSection title={t('faq.title')} items={items} />
      <p className="px-4 pb-10 text-center text-sm text-muted-foreground">
        {t('connect.mcpTitle')}{' '}
        <Link
          className="text-foreground underline underline-offset-4"
          href={ROUTES.mcp.paths[locale]}
        >
          {t('connect.mcpLink')}
        </Link>
      </p>
      <ResourceLinks locale={locale} context="api" />
      <StudioClosing title={t('closing.title')} label={accountLabel} href={accountHref} />
    </StudioShell>
  );
}
