import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';

export default async function LoadingRenders() {
  const t = await getTranslations('AdminInventory');
  return (
    <div className="space-y-4" aria-busy="true">
      <p role="status">{t('loading')}</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Card key={key} className="h-80 animate-pulse motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
