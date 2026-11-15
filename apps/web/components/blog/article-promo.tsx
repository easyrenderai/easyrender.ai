import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Locale } from '@/i18n/config';
import { ROUTES } from '@/lib/seo/routes';

export type PromoCopy = {
  title: string;
  input: string;
  output: string;
  button: string;
  disclosure: string;
};

/** A real example of the free preview, with a localized path and no animated payload. */
export function ArticlePromo({ locale, copy }: { locale: Locale; copy: PromoCopy }) {
  return (
    <Card className="gap-3 overflow-hidden p-4 shadow-none" data-article-promo="">
      <div className="grid grid-cols-2 gap-2">
        {[
          { src: '/showcase/armchair.jpg', label: copy.input, size: 2048 },
          { src: '/showcase/armchair-angles.jpg', label: copy.output, size: 1200 },
        ].map(({ src, label, size }) => (
          <figure key={src}>
            <Image
              src={src}
              alt={label}
              width={size}
              height={size}
              sizes="(min-width: 1024px) 96px, 140px"
              className="aspect-square w-full rounded-md object-contain"
            />
            <figcaption className="mt-1.5 text-xs text-muted-foreground">{label}</figcaption>
          </figure>
        ))}
      </div>
      <p className="text-lg leading-snug font-semibold tracking-tight">{copy.title}</p>
      <Button asChild className="h-auto min-h-9 w-full whitespace-normal text-center">
        <Link href={`${ROUTES.home.paths[locale]}#try`} data-cta="article-sidebar">
          {copy.button}
          <ArrowRight className="shrink-0" aria-hidden />
        </Link>
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">{copy.disclosure}</p>
    </Card>
  );
}
