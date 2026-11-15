// Demo renders made with the easyrender harness (TRELLIS) during testing. They seed the public
// gallery until real users publish their own, and power the floating model in the hero.
// Titles and prompts are the English source; translations live under `Showcase` in messages/.
import { versionedPublicModel } from '@/lib/public-models';

export type ShowcaseSlug =
  | 'swivel-chair'
  | 'coffee-table'
  | 'vase'
  | 'armchair'
  | 'clay-vase'
  | 'bedside-table';

export type ShowcaseItem = {
  id: string;
  slug: ShowcaseSlug;
  title: string;
  prompt: string;
  photo: string;
  angles: string | null;
  model: string;
  category: 'Furniture' | 'Decor' | 'Exterior';
  dimensions: string;
  engine: string;
  createdAt: string;
};

const item = (
  slug: ShowcaseSlug,
  title: string,
  prompt: string,
  category: ShowcaseItem['category'],
  dimensions: string,
  angles = false,
): ShowcaseItem => ({
  id: `demo-${slug}`,
  slug,
  title,
  prompt,
  photo: versionedPublicModel(`/showcase/${slug}.jpg`),
  angles: angles ? `/showcase/${slug}-angles.jpg` : null,
  model: versionedPublicModel(`/showcase/${slug}.glb`),
  category,
  dimensions,
  engine: angles ? 'TRELLIS + angle sheet' : 'TRELLIS',
  createdAt: '2026-11-09T16:47:00.000Z',
});

export const SHOWCASE: ShowcaseItem[] = [
  item(
    'swivel-chair',
    'Swivel armchair',
    'Grey upholstered swivel armchair',
    'Furniture',
    '76 × 81 × 81 cm',
  ),
  item(
    'coffee-table',
    'Round coffee table',
    'Round solid wood coffee table',
    'Furniture',
    '50 × 48.5 × 50 cm',
  ),
  item('vase', 'Stoneware vase', 'Matte stoneware vase', 'Decor', '12.5 × 20 × 12 cm', true),
  item(
    'armchair',
    'Bouclé lounge armchair',
    'Bouclé lounge armchair with a brushed steel frame',
    'Furniture',
    '70 × 77 × 85 cm',
    true,
  ),
  item('clay-vase', 'Clay vase', 'Aged clay vase', 'Decor', '35 × 40 × 35 cm'),
  item(
    'bedside-table',
    'Bedside table',
    'Solid wood bedside table with a drawer',
    'Furniture',
    '52 × 50 × 36 cm',
  ),
];

export const HERO_ITEM = SHOWCASE[0];

export const findShowcase = (id: string) => SHOWCASE.find((entry) => entry.id === id) ?? null;
