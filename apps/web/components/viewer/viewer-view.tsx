import { ArrowRight, ChevronDownIcon } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileViewer } from '@/components/viewer/file-viewer';
import type { Locale } from '@/i18n/config';
import { ROUTES } from '@/lib/seo/routes';
import { VIEWER_FORMATS } from '@/lib/viewer/formats';

const FAQ_KEYS = ['formats', 'privacy', 'textures', 'glb', 'free'] as const;
const STEP_KEYS = ['drop', 'inspect', 'share'] as const;
// The message key of each format: a key cannot start with a digit in a typed lookup.
const FORMAT_KEYS = {
  glb: 'glb',
  gltf: 'gltf',
  obj: 'obj',
  fbx: 'fbx',
  stl: 'stl',
  ply: 'ply',
  '3mf': 'threeMf',
  dae: 'dae',
  usdz: 'usdz',
  '3ds': 'threeDs',
} as const;

/** The questions on the page and in its FAQPage structured data: one source for both. */
export async function viewerFaqItems(locale: Locale) {
  const t = await getTranslations({ locale, namespace: 'Viewer.faq' });
  return FAQ_KEYS.map((key) => ({
    question: t(`items.${key}.q`),
    answer: t(`items.${key}.a`),
  }));
}

/** The free 3D viewer of one language: the tool first, then what it opens and how. */
export async function ViewerView({ locale }: { locale: Locale }) {
  const [t, faq] = await Promise.all([
    getTranslations({ locale, namespace: 'Viewer' }),
    viewerFaqItems(locale),
  ]);

  return (
    <>
      <FileViewer
        intro={
          <header className="flex flex-col items-center gap-4">
            <Badge variant="outline">{t('eyebrow')}</Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              {t('title')}
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground text-pretty">
              {t('description')}
            </p>
          </header>
        }
      />
      <div className="mx-auto max-w-5xl px-4 pb-14 sm:px-6">
        <section className="mt-16 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">{t('formats.title')}</h2>
            <p className="max-w-2xl text-muted-foreground text-pretty">
              {t('formats.description')}
            </p>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
            {VIEWER_FORMATS.map((format) => (
              <li key={format} className="flex gap-4 bg-card p-4">
                <span className="w-12 shrink-0 font-mono text-sm font-medium">
                  {format.toUpperCase()}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t(`formats.items.${FORMAT_KEYS[format]}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16 space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">{t('steps.title')}</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEP_KEYS.map((key, index) => (
              <li key={key}>
                <Card className="h-full">
                  <CardHeader>
                    <CardDescription className="font-mono text-xs">
                      {String(index + 1).padStart(2, '0')}
                    </CardDescription>
                    <CardTitle className="text-base">{t(`steps.${key}.title`)}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {t(`steps.${key}.body`)}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16 flex flex-col items-start gap-4 rounded-xl border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{t('cta.title')}</h2>
            <p className="max-w-xl text-sm text-muted-foreground">{t('cta.body')}</p>
          </div>
          <Button asChild>
            <Link href={`${ROUTES.home.paths[locale]}#try`}>
              {t('cta.action')}
              <ArrowRight />
            </Link>
          </Button>
        </section>

        <section id="faq" className="mt-16 space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">{t('faq.title')}</h2>
          {/* Native <details>, like the home FAQ: every answer stays in the server HTML. */}
          <div>
            {faq.map((item) => (
              <details key={item.question} className="group border-b last:border-b-0">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-md py-4 text-left font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-base font-medium">{item.question}</h3>
                  <ChevronDownIcon className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
