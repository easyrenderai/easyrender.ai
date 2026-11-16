import { SHOWCASE } from '@/lib/showcase';

// Snapshot of the existing public render, not a new generation. See showcase/README.md.
export const TABLE_EXAMPLE = {
  id: 'cmwceijqd000007l23vfjeftv',
  slug: 'table' as const,
  photo: '/showcase/table.jpg',
  angles: '/showcase/table-angles.png',
  model: '/showcase/table.glb',
};

// Deliberately curated: having an angle sheet does not make an asset a marketing example.
export const TRY_ONE_EXAMPLES = [TABLE_EXAMPLE, ...SHOWCASE.filter((item) => item.slug === 'vase')];
