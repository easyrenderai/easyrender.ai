import { ArrowUpRight, Box, Globe, Plus, ShoppingBag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { RenderJourneyVideo } from '@/components/render-journey-video';
import { SiteLink } from '@/components/site-link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

const JOURNEYS = [
  { key: 'web', Icon: Globe, href: 'https://modelviewer.dev/editor/' },
  {
    key: 'shop',
    Icon: ShoppingBag,
    href: 'https://help.shopify.com/en/manual/products/product-media/add-media',
  },
  {
    key: 'design',
    Icon: Box,
    href: 'https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html',
  },
] as const;
const STEPS = ['download', 'prepare', 'use'] as const;

/** Guidance for an owner's finished model. It never uploads, publishes or changes visibility. */
export function RenderNextSteps({
  downloads,
  createHref,
}: {
  downloads: ReactNode;
  createHref: string;
}) {
  const t = useTranslations('Render.nextSteps');
  return (
    <section className="render-next-steps space-y-5 rounded-xl border p-5" aria-label={t('title')}>
      <div className="space-y-2">
        <h2 className="text-lg font-medium tracking-tight">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('formats')}</p>
        {downloads}
      </div>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">{t('choose')}</p>
        <Accordion type="multiple">
          {JOURNEYS.map(({ key, Icon, href }) => (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger>
                <span className="flex items-center gap-3">
                  <Icon className="size-4" aria-hidden />
                  {t(`${key}.title`)}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <RenderJourneyVideo journey={key} />
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm underline underline-offset-4 focus-visible:outline-ring">
                    {t('video.readSteps')}
                  </summary>
                  <ol className="mt-4 list-decimal space-y-4 pl-5">
                    {STEPS.map((stepKey) => (
                      <li key={stepKey}>
                        <h3 className="text-sm font-medium">
                          {t(`${key}.steps.${stepKey}.title`)}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {t(`${key}.steps.${stepKey}.body`)}
                        </p>
                      </li>
                    ))}
                  </ol>
                </details>
                <Button asChild variant="outline" size="sm" className="mt-5 max-w-full">
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {t(`${key}.action`)}
                    <ArrowUpRight aria-hidden />
                  </a>
                </Button>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      <Button asChild variant="ghost" className="px-0">
        <SiteLink href={createHref}>
          <Plus aria-hidden />
          {t('createAnother')}
        </SiteLink>
      </Button>
    </section>
  );
}
