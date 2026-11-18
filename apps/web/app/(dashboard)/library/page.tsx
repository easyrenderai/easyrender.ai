import { getBalance, listLibrary, toView } from '@easyrender/core';
import { RENDER_CREDITS, SHEET_CREDITS } from '@easyrender/harness';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { CatalogLibrary } from '@/components/catalog-library';
import { currentUser } from '@/lib/actor';
import { localizedSignInPath } from '@/lib/app-locale';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Library');
  return { title: t('metaTitle') };
}

export default async function LibraryPage() {
  const user = await currentUser();
  if (!user) redirect(localizedSignInPath(await getLocale(), '/library'));
  const [renders, balance] = await Promise.all([listLibrary(user.id), getBalance(user.id)]);
  return (
    <CatalogLibrary
      initial={renders.map(toView)}
      initialBalance={balance}
      renderCredits={RENDER_CREDITS}
      sheetCredits={SHEET_CREDITS}
    />
  );
}
