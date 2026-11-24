import Link from 'next/link';
import { getMessages, getTranslations } from 'next-intl/server';
import { AdminNavigation } from '@/components/admin-analytics/dashboard';
import { AdminRenderCard } from '@/components/admin-analytics/render-card';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { requireAdmin } from '@/lib/admin-analytics/auth';
import { rendersData } from '@/lib/admin-analytics/inventory';

export async function generateMetadata() {
  return { title: (await getTranslations('AdminInventory'))('renders') };
}
export default async function AdminRendersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const search = await searchParams;
  const t = await getTranslations('AdminInventory');
  const labels = (await getMessages()).AdminAnalytics.labels as Record<string, string>;
  const data = await rendersData(
    typeof search.page === 'string' ? search.page : undefined,
    typeof search.status === 'string' ? search.status : undefined,
  );
  const href = (page: number, status = data.status ?? '') =>
    `/admin/renders?${new URLSearchParams({ page: String(page), ...(status ? { status } : {}) })}`;
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('renders')}</h1>
        <p className="text-sm text-muted-foreground">{t('rendersNote')}</p>
      </header>
      <AdminNavigation labels={labels} section="renderGallery" />
      <nav aria-label={t('statusFilter')} className="flex flex-wrap gap-2">
        {(['', 'ready', 'failed', 'rendering', 'drafting', 'preview_ready'] as const).map(
          (status) => (
            <Button
              key={status}
              asChild
              size="sm"
              variant={(data.status ?? '') === status ? 'secondary' : 'outline'}
            >
              <Link
                href={href(1, status)}
                aria-current={(data.status ?? '') === status ? 'page' : undefined}
              >
                {status ? t(status) : labels.all}
              </Link>
            </Button>
          ),
        )}
      </nav>
      <p className="text-xs tabular-nums text-muted-foreground">
        {t('renderCount', { total: data.total })}
      </p>
      {data.renders.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
          {data.renders.map((render) => (
            <AdminRenderCard key={render.id} render={render} />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>{t('emptyRenders')}</CardHeader>
        </Card>
      )}
      <nav
        aria-label={t('pagination')}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <span className="text-sm tabular-nums text-muted-foreground">
          {t('pageCount', { page: data.page, pages: data.pages })}
        </span>
        <div className="flex gap-2">
          {data.page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href(data.page - 1)}>{labels.previous}</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              {labels.previous}
            </Button>
          )}
          {data.page < data.pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href(data.page + 1)}>{labels.next}</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              {labels.next}
            </Button>
          )}
        </div>
      </nav>
    </div>
  );
}
