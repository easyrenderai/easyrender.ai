import { verifyLinkState } from '@easyrender/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ShopifyConnectButton } from '@/components/shopify-connect-button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { currentUser } from '@/lib/actor';
import { noindexMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = noindexMetadata('Easy Render 3D & AR');

// Opened in a new tab from the Shopify app: the merchant signs in to easyrender and links the shop
// to their account, which pays for its models.
export default async function ShopifyConnectPage({ searchParams }: PageProps<'/shopify/connect'>) {
  const params = await searchParams;
  const state = typeof params.state === 'string' ? params.state : null;
  const t = await getTranslations('ShopifyConnect');
  let shop: string | null = null;
  try {
    shop = verifyLinkState(state);
  } catch {
    shop = null;
  }
  if (!shop || !state) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Alert variant="destructive">
          <AlertDescription>{t('invalid')}</AlertDescription>
        </Alert>
      </div>
    );
  }
  const user = await currentUser();
  const next = `/shopify/connect?${new URLSearchParams({ shop, state })}`;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{t('title', { shop })}</CardTitle>
          <CardDescription>{t('body')}</CardDescription>
        </CardHeader>
        <CardContent>
          {user ? (
            <ShopifyConnectButton state={state} />
          ) : (
            <Button asChild className="h-10">
              <Link href={`/sign-in?next=${encodeURIComponent(next)}`}>{t('signIn')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
