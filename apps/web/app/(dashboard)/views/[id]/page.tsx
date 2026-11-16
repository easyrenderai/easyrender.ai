import { AppError, getBalance, getViewSet, toViewSetView } from '@easyrender/core';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ProductViewsDetail } from '@/components/product-views-detail';
import { currentUser } from '@/lib/actor';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ProductViews');
  return { title: t('metaTitle') };
}

export default async function ProductViewsSetPage({ params }: PageProps<'/views/[id]'>) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=/views/${id}`);
  const set = await getViewSet(id, { userId: user.id }).catch((error) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  return <ProductViewsDetail initial={toViewSetView(set)} balance={await getBalance(user.id)} />;
}
