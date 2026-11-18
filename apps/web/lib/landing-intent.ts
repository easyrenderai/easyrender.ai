import type { Locale } from '@/i18n/config';
import { TABLE_EXAMPLE } from '@/lib/marketing-examples';
import { ROUTES } from '@/lib/seo/routes';

const GROUPS = {
  '3d-models-for-ecommerce': 'commerce',
  'sell-vintage-furniture-online': 'commerce',
  'product-photography-for-ecommerce': 'commerce',
  'glb-file': 'format',
  'usdz-file': 'usdz',
  'compare-meshy': 'tools',
  'compare-tripo': 'tools',
  'compare-polycam': 'scan',
  'compare-3d-modeler-vs-ai': 'precision',
  'compare-360-vs-3d': 'interactive',
  'compare-photogrammetry-software': 'scan',
} as const;

/** Stable editorial group IDs work across translations; unknown guides keep the photo path. */
export function landingIntent(group: string, locale: Locale) {
  const key = Object.hasOwn(GROUPS, group) ? GROUPS[group as keyof typeof GROUPS] : 'photo';
  const uploadHref = `${ROUTES.home.paths[locale]}#try`;
  if (key === 'format' || key === 'usdz' || key === 'interactive') {
    return { key, href: `/r/${TABLE_EXAMPLE.id}`, action: 'inspect', uploadHref } as const;
  }
  return { key, href: uploadHref, action: 'upload' } as const;
}
