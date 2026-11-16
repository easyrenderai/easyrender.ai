import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ShellPanel } from '@/components/app-shell/shell-context';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export type DetailMeta = { label: string; value: ReactNode };

// Shared layout of a generation's page: the result, then what it was made from.
export function RenderDetail({
  title,
  prompt,
  badges,
  viewer,
  input,
  angles,
  meta,
  actions,
  isInApp = false,
  isViewerFirst = true,
}: {
  title: string;
  prompt: string | null;
  badges?: string[];
  viewer: ReactNode;
  input: string | null;
  angles: ReactNode;
  meta: DetailMeta[];
  actions?: ReactNode;
  // Inside the signed-in shell the page is split: the result in the middle, its parts in the right drawer.
  isInApp?: boolean;
  // A finished model leads the page. Until there is one, the photo and its angles come first and
  // the viewer waits below them.
  isViewerFirst?: boolean;
}) {
  const t = useTranslations('Render');

  const inputCard = (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">{t('inputPhoto')}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {input ? (
          // biome-ignore lint/performance/noImgElement: served by our own API or /public
          <img
            src={input}
            alt={t('sourceAlt', { title })}
            className="aspect-square w-full rounded-lg border bg-white object-contain"
          />
        ) : (
          <div className="aspect-square w-full rounded-lg border bg-muted" />
        )}
      </CardContent>
    </Card>
  );
  const anglesCard = (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">{t('everyAngle')}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">{angles}</CardContent>
    </Card>
  );
  const metaList = (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {meta.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="text-right">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
  const promptBlock = (
    <div className="space-y-1.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t('prompt')}
      </p>
      <p className="rounded-lg border bg-muted/40 p-3 text-sm">
        {prompt || <span className="text-muted-foreground">{t('noPrompt')}</span>}
      </p>
    </div>
  );
  const badgeRow = badges && badges.length > 0 && (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <Badge key={badge} variant="secondary">
          {badge}
        </Badge>
      ))}
    </div>
  );

  // Inside the app the page is split: the result and what you can do to it in the middle, and the
  // parts it is made of (photo, angle sheet, details) in the right drawer. On a narrow screen the
  // parts follow the result in the page.
  if (isInApp) {
    return (
      <div className="space-y-6">
        {isViewerFirst && viewer}
        <Card>
          <CardHeader className="gap-3">
            {badgeRow}
            <CardTitle className="text-xl leading-tight">{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {promptBlock}
            {actions && <div className="space-y-3">{actions}</div>}
          </CardContent>
        </Card>
        {!isViewerFirst && viewer}
        <ShellPanel>
          <div className="space-y-4 xl:p-4">
            {inputCard}
            {anglesCard}
            <Card className="gap-3 py-4">
              <CardHeader className="px-4">
                <CardTitle className="text-sm">{t('details')}</CardTitle>
              </CardHeader>
              <CardContent className="px-4">{metaList}</CardContent>
            </Card>
          </div>
        </ShellPanel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/explore" className="hover:text-foreground">
          {t('gallery')}
        </Link>
        <ChevronRight className="size-4" />
        <span className="truncate text-foreground">{title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {isViewerFirst && viewer}
          <div className="grid items-start gap-4 sm:grid-cols-[1fr_2fr]">
            {inputCard}
            {anglesCard}
          </div>
          {!isViewerFirst && viewer}
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader className="gap-3">
              {badgeRow}
              <CardTitle className="text-xl leading-tight">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {promptBlock}
              <Separator />
              {metaList}
              {actions && (
                <>
                  <Separator />
                  <div className="space-y-3">{actions}</div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export const DATE_FORMAT = { month: 'short', day: 'numeric', year: 'numeric' } as const;
