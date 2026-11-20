import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { IntlBoundary } from '@/components/intl-boundary';
import { SiteChrome } from '@/components/site-chrome';
import { Button } from '@/components/ui/button';

// A path that matches no page. The root layout does not draw the site header, so the 404 brings its
// own frame and its own translations. It is English and built once; a missing page inside a
// language branch is answered by that branch's own not-found.
export default async function NotFound() {
  const t = await getTranslations({ locale: 'en', namespace: 'NotFound' });
  return (
    <IntlBoundary locale="en" isFallback>
      <SiteChrome locale="en">
        <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-24 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
          <Button asChild>
            <Link href="/">{t('home')}</Link>
          </Button>
        </div>
      </SiteChrome>
    </IntlBoundary>
  );
}
