import { versionedPublicModel } from '@/lib/public-models';

import data from './catalog.json';

// The hub's elements. Names and prompts are translated under `Catalog` in messages/; everything
// here is language-neutral. Sizes are in metres as [width, height, depth].
export type CategoryKey = 'furniture' | 'decor' | 'lighting' | 'product' | 'props' | 'outdoor';
export type MaterialKey =
  | 'upholstery'
  | 'wood'
  | 'ceramic'
  | 'metal'
  | 'steel'
  | 'concrete'
  | 'leather'
  | 'polymer';
export type ColliderKey = 'box' | 'cylinder' | 'hull';
// TRELLIS items came out of the easyrender harness; `tripo` ones were generated elsewhere to fill
// categories the harness has not covered yet.
export type EngineKey = 'trellis' | 'trellisSheet' | 'tripo';

export type ItemId =
  | 'swivel-chair'
  | 'armchair'
  | 'coffee-table'
  | 'bedside-table'
  | 'vase'
  | 'clay-vase'
  | 'sofa'
  | 'lamp'
  | 'cactus'
  | 'sneaker'
  | 'espresso'
  | 'crate'
  | 'barrel';

export type Lod = { file: string; tris: number; verts: number; kb: number };

export type CatalogItem = {
  id: ItemId;
  category: CategoryKey;
  engine: EngineKey;
  dims: [number, number, number];
  material: MaterialKey;
  // Estimated from the bounding box and a per-material density; good enough for the demo.
  mass: number;
  friction: number;
  restitution: number;
  collider: ColliderKey;
  hullVerts: number;
  wireTris: number;
  lods: [Lod, Lod, Lod];
  // LOD0 with its maps at 2048 px, for elements whose source carries that much detail. It is what
  // the sheet inspects and what the download hands over; the page itself runs on `lods`.
  hd?: { file: string; kb: number };
  formats: string[];
};

export const CATALOG = data as CatalogItem[];

export const CATEGORIES: CategoryKey[] = [
  'furniture',
  'decor',
  'lighting',
  'product',
  'props',
  'outdoor',
];

const index = new Map<string, CatalogItem>(CATALOG.map((item) => [item.id, item]));

export const findItem = (id: string) => index.get(id) ?? null;

export function itemOf(id: string): CatalogItem {
  const item = index.get(id);
  if (!item) throw new Error(`Unknown hub element: ${id}`);
  return item;
}

// The best file an element has.
export const fullFile = (item: CatalogItem) => item.hd ?? item.lods[0];

export const modelUrl = (file: string) => versionedPublicModel(`/studio/models/${file}`);
export const photoUrl = (id: string) => `/studio/photos/${id}.jpg`;
