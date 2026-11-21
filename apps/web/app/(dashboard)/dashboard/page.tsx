import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { HomeComposer } from '@/components/app-shell/home-composer';
import { currentUser } from '@/lib/actor';
import { localizedSignInPath } from '@/lib/app-locale';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Dashboard');
  return { title: t('metaTitle') };
}

// Home: one job, add a photo and get a free preview. The renders are in the Library, the numbers
// are in the rail previews, and the email series opt-in is on the Account page.
export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect(localizedSignInPath(await getLocale(), '/dashboard'));
  return <HomeComposer />;
}
