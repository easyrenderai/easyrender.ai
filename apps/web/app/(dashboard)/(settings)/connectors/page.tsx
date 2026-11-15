import { config, isApiKeyScope, listApiKeys } from '@easyrender/core';
import { Globe, ShoppingBag, Store } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ConnectorsPanel } from '@/components/connectors-panel';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { currentUser } from '@/lib/actor';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Connectors');
  return { title: t('metaTitle') };
}

const SOON = [
  { icon: ShoppingBag, key: 'shopify' },
  { icon: Store, key: 'woo' },
  { icon: Globe, key: 'listings' },
] as const;

export default async function ConnectorsPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/connectors');
  const [keys, t] = await Promise.all([listApiKeys(user.id), getTranslations('Connectors')]);

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
          {SOON.map((item) => (
            <Card key={item.key} className="gap-3">
              <CardHeader>
                <div className="mb-2 flex items-center justify-between">
                  <item.icon className="size-5 text-muted-foreground" />
                  <Badge variant="outline">{t('comingSoon')}</Badge>
                </div>
                <CardTitle>{t(`soon.${item.key}.title`)}</CardTitle>
                <CardDescription className="leading-relaxed">
                  {t(`soon.${item.key}.body`)}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
