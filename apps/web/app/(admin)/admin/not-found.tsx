import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

// A missing admin page, such as an unknown analytics section. It renders inside the admin layout,
// which already draws the app shell, so it brings no frame of its own.
export default async function AdminNotFound() {
  const t = await getTranslations('NotFound');
  return (
    <div className="flex max-w-xl flex-col items-start gap-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-muted-foreground">{t('description')}</p>
      <Button asChild>
        <Link href="/">{t('home')}</Link>
      </Button>
    </div>
  );
}
