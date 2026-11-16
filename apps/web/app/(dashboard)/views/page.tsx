import { getBalance, listViewSets, toViewSetView } from '@easyrender/core';
import { PRODUCT_VIEWS_CREDITS } from '@easyrender/harness/pricing';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ProductViewsStudio } from '@/components/product-views-studio';
import { currentUser } from '@/lib/actor';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ProductViews');
  return { title: t('metaTitle') };
}

export default async function ProductViewsPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/views');
  const [sets, balance] = await Promise.all([listViewSets(user.id), getBalance(user.id)]);
  return (
    <ProductViewsStudio
      sets={sets.map(toViewSetView)}
      balance={balance}
      credits={PRODUCT_VIEWS_CREDITS}
    />
  );
}
