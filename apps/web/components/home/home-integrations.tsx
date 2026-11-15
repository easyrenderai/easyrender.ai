import { ArrowRight, Bot, Code2 } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Section } from '@/components/landing';
import { SiteLink as Link } from '@/components/site-link';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { isPublished, ROUTES } from '@/lib/seo/routes';

export async function HomeIntegrations() {
  const [t, locale] = await Promise.all([getTranslations('Home.integrations'), getLocale()]);
  return (
    <Section id="connect" title={t('title')} description={t('description')}>
      <div className="grid gap-8 md:grid-cols-2">
        {(
          [
            { kind: 'mcp', icon: Bot },
            { kind: 'api', icon: Code2 },
          ] as const
        ).map(({ kind, icon: Icon }) => {
          const targetLocale = isPublished(kind, locale as Locale) ? (locale as Locale) : 'en';
          return (
            <div key={kind} className="space-y-3 border-t pt-6">
              <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-xl font-medium">{t(`${kind}.title`)}</h3>
              <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                {t(`${kind}.body`)}
              </p>
              <Button variant="outline" asChild>
                <Link href={ROUTES[kind].paths[targetLocale]} hrefLang={targetLocale}>
                  {t(`${kind}.cta`)}
                  {targetLocale !== locale ? ` (${t('english')})` : ''}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
