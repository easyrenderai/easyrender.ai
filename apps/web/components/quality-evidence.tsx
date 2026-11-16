import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/i18n/config';
import { TABLE_EXAMPLE } from '@/lib/marketing-examples';
import { ROUTES } from '@/lib/seo/routes';

/** Public evidence stays separate from benchmark scores and production quality guarantees. */
export function QualityEvidence({
  locale,
  showEvals = false,
  copy,
}: {
  copy: { title: string; body: string; upload: string; sample: string; evals: string };
  locale: Locale;
  showEvals?: boolean;
}) {
  return (
    <section className="mt-8 space-y-4 rounded-xl border p-5 sm:p-6">
      <h2 className="text-xl font-medium tracking-tight">{copy.title}</h2>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`${ROUTES.home.paths[locale]}#try`}>{copy.upload}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/r/${TABLE_EXAMPLE.id}`}>{copy.sample}</Link>
        </Button>
        {showEvals && (
          <Button asChild variant="ghost">
            <Link href={ROUTES.evals.paths[locale]}>{copy.evals}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
