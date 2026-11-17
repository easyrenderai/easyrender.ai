import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { PromoVideo } from '@/components/blog/promo-video';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Locale } from '@/i18n/config';
import { ROUTES } from '@/lib/seo/routes';

export type PromoCopy = {
  title: string;
  solution: string;
  visual: string;
  play: string;
  pause: string;
  button: string;
  disclosure: string;
};

/** Photo limitation → a model revealed in a room → one action. Copy stays readable in every frame and locale. */
export function ArticlePromo({
  locale,
  copy,
  href,
  position = 'sidebar',
}: {
  locale: Locale;
  copy: PromoCopy;
  href?: string;
  position?: 'mobile' | 'sidebar';
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-none" data-article-promo="">
      <p className="px-4 py-4 text-xl leading-tight font-semibold tracking-tight text-balance">
        {copy.title}
      </p>
      <PromoVideo label={copy.visual} play={copy.play} pause={copy.pause} />
      <div className="space-y-3 p-4">
        <p className="text-sm leading-snug font-medium">{copy.solution}</p>
        <Button asChild className="h-auto min-h-9 w-full whitespace-normal text-center">
          <Link
            href={href ?? `${ROUTES.home.paths[locale]}#try`}
            data-cta="article-sidebar"
            data-article-cta={position}
          >
            {copy.button}
            <ArrowRight className="shrink-0" aria-hidden />
          </Link>
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">{copy.disclosure}</p>
      </div>
    </Card>
  );
}
