import type { Locale } from '@/i18n/config';
import { TABLE_EXAMPLE } from '@/lib/marketing-examples';
import { ROUTES } from '@/lib/seo/routes';

const GROUPS = {
  '3d-models-for-ecommerce': 'commerce',
  'sell-vintage-furniture-online': 'commerce',
  'product-photography-for-ecommerce': 'commerce',
  'glb-file': 'format',
  'usdz-file': 'format',
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
  const isInspection = key === 'format' || key === 'interactive';
  return {
    key,
    href: isInspection ? `/r/${TABLE_EXAMPLE.id}` : `${ROUTES.home.paths[locale]}#try`,
    action: isInspection ? 'inspect' : 'upload',
  } as const;
}
