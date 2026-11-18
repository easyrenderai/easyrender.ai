import { config, isApiKeyScope, listApiKeys } from '@easyrender/core';
import { Globe, ShoppingBag, Store } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ConnectorsPanel } from '@/components/connectors-panel';
import { SiteLink } from '@/components/site-link';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Locale } from '@/i18n/config';
import { currentUser } from '@/lib/actor';
import { localizedSignInPath } from '@/lib/app-locale';
import { isPublished, ROUTES } from '@/lib/seo/routes';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Connectors');
  return { title: t('metaTitle') };
}

const INTEGRATIONS = [
  { icon: ShoppingBag, key: 'shopify' },
  { icon: Store, key: 'woo' },
  { icon: Globe, key: 'listings' },
] as const;

export default async function ConnectorsPage() {
  const [user, locale] = await Promise.all([currentUser(), getLocale()]);
  if (!user) redirect(localizedSignInPath(locale, '/connectors'));
  const [keys, t] = await Promise.all([listApiKeys(user.id), getTranslations('Connectors')]);
  const storeLocale = isPublished('ecommerce', locale as Locale) ? (locale as Locale) : 'en';
  const storeHref = ROUTES.ecommerce.paths[storeLocale];

  return (
    <div className="space-y-8">
      <ConnectorsPanel
        initial={keys.map((key) => ({
          ...key,
          scopes: key.scopes.filter(isApiKeyScope),
          createdAt: key.createdAt.toISOString(),
          lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          expiresAt: key.expiresAt?.toISOString() ?? null,
        }))}
        mcpUrl={`${config.appUrl()}/api/mcp`}
      />
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{t('more')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {INTEGRATIONS.map((item) => (
            <Card key={item.key} className="gap-3">
              <CardHeader>
                <div className="mb-2 flex items-center justify-between">
                  <item.icon className="size-5 text-muted-foreground" />
                  <Badge variant="outline">
                    {t(item.key === 'listings' ? 'comingSoon' : `soon.${item.key}.status`)}
                  </Badge>
                </div>
                <CardTitle>{t(`soon.${item.key}.title`)}</CardTitle>
                <CardDescription className="leading-relaxed">
                  {t(`soon.${item.key}.body`)}
                </CardDescription>
                {item.key !== 'listings' && (
                  <SiteLink
                    href={`${storeHref}?platform=${item.key === 'woo' ? 'woocommerce' : 'shopify'}`}
                    hrefLang={storeLocale}
                    className="text-sm underline underline-offset-4"
                  >
                    {t('setup')}
                    {storeLocale !== locale && ` (${t('english')})`}
                  </SiteLink>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
