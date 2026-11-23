import { ChevronRight, Download } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ShellPanel } from '@/components/app-shell/shell-context';
import { RenderContextTabs } from '@/components/render-context-tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export type DetailMeta = { label: string; value: ReactNode };

// Shared layout of a generation's page: the result, then what it was made from.
export function RenderDetail({
  title,
  prompt,
  badges,
  viewer,
  input,
  angles,
  anglesUrl = null,
  meta,
  actions,
  isInApp = false,
  isViewerFirst = true,
  isReviewingAngles = false,
  activity,
  toolbar,
  history,
  historyCount = 0,
}: {
  activity?: ReactNode;
  // Sits beside the title, for the one control the owner reaches for most (gallery visibility).
  toolbar?: ReactNode;
  // The owner's history of edits: the second tab of the context panel. Without it there is no tab.
  history?: ReactNode;
  historyCount?: number;
  isReviewingAngles?: boolean;
  title: string;
  prompt: string | null;
  badges?: string[];
  viewer: ReactNode;
  input: string | null;
  angles: ReactNode;
  // Where the angle sheet can be downloaded from, once it exists.
  anglesUrl?: string | null;
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
        {input && (
          <CardAction>
            <Button variant="ghost" size="icon-sm" asChild>
              <a href={input} download aria-label={t('downloadPhoto')} title={t('downloadPhoto')}>
                <Download />
              </a>
            </Button>
          </CardAction>
        )}
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
        {anglesUrl && (
          <CardAction>
            <Button variant="ghost" size="icon-sm" asChild>
              <a
                href={anglesUrl}
                download
                aria-label={t('downloadAngles')}
                title={t('downloadAngles')}
              >
                <Download />
              </a>
            </Button>
          </CardAction>
        )}
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
    const views = (
      <>
        {inputCard}
        {!isReviewingAngles && anglesCard}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle className="text-sm">{t('details')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4">
            {metaList}
            {promptBlock}
          </CardContent>
        </Card>
      </>
    );
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="min-w-0 text-xl leading-tight font-semibold break-words line-clamp-2">
            {title}
          </h1>
          {badgeRow}
          {toolbar && <div className="ms-auto">{toolbar}</div>}
        </div>
        {activity}
        {isViewerFirst && viewer}
        {isReviewingAngles && anglesCard}
        {actions && (
          <Card>
            <CardContent className="space-y-3">{actions}</CardContent>
          </Card>
        )}
        {!isViewerFirst && !isReviewingAngles && viewer}
        <ShellPanel>
          <div className="xl:p-4">
            {history ? (
              <RenderContextTabs views={views} history={history} historyCount={historyCount} />
            ) : (
              <div className="space-y-4">{views}</div>
            )}
          </div>
        </ShellPanel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      {activity}
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
          {!isViewerFirst && !isReviewingAngles && viewer}
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
