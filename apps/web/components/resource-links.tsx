import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n/config';
import { type ResourceContext, resourceLinks } from '@/lib/seo/resources';

export async function ResourceLinks({
  locale,
  context,
}: {
  locale: Locale;
  context: ResourceContext;
}) {
  const [t, links] = await Promise.all([
    getTranslations({ locale, namespace: 'Resources' }),
    getTranslations({ locale, namespace: 'Footer.links' }),
  ]);
  const resources = resourceLinks(locale, context);
  return (
    <section className="mx-auto w-full max-w-6xl border-t px-4 py-12 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-tight">{t('title')}</h2>
      <p className="mt-3 text-muted-foreground">{t('description')}</p>
      <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-4">
        {resources.guides.map((item) => (
          <li key={item.href}>
            <Link className="underline underline-offset-4" href={item.href}>
              {item.title}
            </Link>
          </li>
        ))}
        {resources.routes.map((item) => (
          <li key={item.href}>
            <Link className="underline underline-offset-4" href={item.href}>
              {links(item.key)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
