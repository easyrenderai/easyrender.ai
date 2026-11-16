import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { ROUTES } from '@/lib/seo/routes';

const SECTIONS = {
  privacy: [
    'collection',
    'purposes',
    'public',
    'providers',
    'transfers',
    'retention',
    'cookies',
    'rights',
    'changes',
  ],
  terms: [
    'service',
    'accounts',
    'credits',
    'refunds',
    'ownership',
    'public',
    'use',
    'availability',
    'liability',
    'law',
  ],
} as const;

export async function LegalPage({ kind, locale }: { kind: 'privacy' | 'terms'; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'Legal' });
  const sections =
    kind === 'privacy'
      ? SECTIONS.privacy.map((key) => ({
          key,
          title: t(`privacy.sections.${key}.title`),
          body: t(`privacy.sections.${key}.body`),
        }))
      : SECTIONS.terms.map((key) => ({
          key,
          title: t(`terms.sections.${key}.title`),
          body: t(`terms.sections.${key}.body`),
        }));
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">{t(`${kind}.title`)}</h1>
        <p className="text-sm text-muted-foreground">{t('updated')}</p>
        <p className="text-sm text-muted-foreground">{t('languageNotice')}</p>
      </header>
      {/* English source text is intentional; localized navigation never disguises its language. */}
      <div lang="en" className="space-y-8 text-sm leading-7">
        <section aria-labelledby="legal-operator" className="rounded-lg border bg-muted/30 p-5">
          <h2 id="legal-operator" className="text-lg font-medium">
            {t('operator.title')}
          </h2>
          {(['name', 'taxId', 'address', 'contact'] as const).map((key) => (
            <p key={key}>{t(`operator.${key}`)}</p>
          ))}
        </section>
        <p>{t(`${kind}.intro`)}</p>
        {sections.map((section) => (
          <section key={section.key} aria-labelledby={`legal-${section.key}`} className="space-y-2">
            <h2 id={`legal-${section.key}`} className="text-lg font-medium">
              {section.title}
            </h2>
            <p className="text-muted-foreground">{section.body}</p>
          </section>
        ))}
      </div>
      <nav
        aria-label={t('navigation')}
        className="flex flex-wrap gap-x-6 gap-y-3 border-t pt-6 text-sm"
      >
        {(['privacy', 'terms', 'cookies'] as const).map((route) => (
          <Link
            key={route}
            href={ROUTES[route].paths[locale]}
            className="underline underline-offset-4"
          >
            {t(route === 'cookies' ? 'cookies' : `${route}.title`)}
          </Link>
        ))}
      </nav>
    </article>
  );
}
