import { getMessages, getTranslations } from 'next-intl/server';
import { AdminNavigation } from '@/components/admin-analytics/dashboard';
import { GiftCreditsPanel } from '@/components/admin-gifts/gift-credits-panel';
import { requireAdmin } from '@/lib/admin-analytics/auth';

export async function generateMetadata() {
  const t = await getTranslations('AdminGift');
  return { title: t('title') };
}

export default async function GiftCreditsPage() {
  await requireAdmin();
  const t = await getTranslations('AdminGift');
  const messages = await getMessages();
  const labels = messages.AdminAnalytics.labels as Record<string, string>;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {t('eyebrow')}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
          {t('internal')}
        </span>
      </header>
      <AdminNavigation labels={labels} section="giftCredits" />
      <GiftCreditsPanel />
    </div>
  );
}
