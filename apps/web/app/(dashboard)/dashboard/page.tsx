import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { HomeComposer } from '@/components/app-shell/home-composer';
import { MailingPreferences } from '@/components/mailing-preferences';
import { currentUser } from '@/lib/actor';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Dashboard');
  return { title: t('metaTitle') };
}

// Home: drop a photo, get a free preview. The numbers that used to sit here are in the rail
// previews, and the latest renders are in the panel beside the page.
export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/dashboard');
  return (
    <div className="space-y-8">
      <HomeComposer />
      <div className="mx-auto max-w-2xl">
        <MailingPreferences userId={user.id} />
      </div>
    </div>
  );
}
