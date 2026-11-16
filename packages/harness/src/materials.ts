// Material profiles: what a material can physically do, written as visual instructions for the
// sheet model. A 3D model that a professional can start from has to look makeable: stone is cut
// and carved, never bent; tube bends in smooth arcs; solid wood follows its grain. Each profile
// is matched against the product name and the user's note and adds a short rule block to the
// sheet prompt. The figures and their sources are in .agents/memory/context/materials-*.md.
// Plain data, like the skills, so a profile is a few lines to add or tune.

export type MaterialProfile = {
  id: string;
  label: string;
  // Matched against the product name and the user's note, English and Spanish.
  keywords: string[];
  guidance: string;
};

export const MATERIALS: MaterialProfile[] = [
  {
    id: 'stone',
    label: 'Marble and stone',
    keywords: [
      'marble',
      'granite',
      'travertine',
      'quartzite',
      'terrazzo',
      'onyx',
      'limestone',
      'stone',
      'marmol',
      'mármol',
      'granito',
      'travertino',
      'piedra',
    ],
    guidance:
      'Stone is brittle: strong when pressed, weak when bent or pulled. Show stone parts as cut slabs or carved solid forms, never bent, folded or moulded like plastic. Keep tops and slabs visibly thick (about 2 to 3 cm or more), with eased or softly bevelled edges instead of razor-thin ones. Curves are shallow or carved from a thick block (pedestals, rounded edges), and thin curved ribbons, hairline legs and long unsupported overhangs are not credible: tops sit on legs, pedestals or a base. Keep one continuous vein pattern through the solid, with the polish or honed finish shown in the photo.',
  },
  {
    id: 'wood',
    label: 'Wood and veneer',
    keywords: [
      'wood',
      'wooden',
      'oak',
      'walnut',
      'ash',
      'teak',
      'beech',
      'maple',
      'cherry',
      'pine',
      'plywood',
      'veneer',
      'bentwood',
      'madera',
      'roble',
      'nogal',
      'fresno',
      'haya',
      'pino',
      'contrachapado',
    ],
    guidance:
      'Wood has a grain that runs along each part: legs, rails and arms follow their length and the grain flows continuously over a part. Tight or deep curves are only credible as steam-bent or laminated parts (smooth, even thickness, long grain) or as thick sawn curves; do not show thin parts with sharp bends or short cross-grain. Keep real joinery and edges: visible joints, layered plywood edges where the photo shows them, and the same species and finish on matching parts.',
  },
  {
    id: 'metal',
    label: 'Metal tube and sheet',
    keywords: [
      'metal',
      'steel',
      'stainless',
      'aluminium',
      'aluminum',
      'brass',
      'copper',
      'bronze',
      'chrome',
      'iron',
      'tubular',
      'wire',
      'metálico',
      'metalico',
      'acero',
      'inox',
      'aluminio',
      'latón',
      'laton',
      'cobre',
      'bronce',
      'cromo',
      'hierro',
    ],
    guidance:
      'Metal tube and rod bend in smooth arcs of constant radius, never in sharp kinks: keep every bend at least about twice the tube diameter, with straight sections between bends and no knots, loops or coils. Tube keeps one section and wall thickness through a bend. Sheet metal folds along straight lines with a small radius, and cast or welded joints show a clean seam. Keep the finish (brushed, polished, powder-coated, plated) and where it catches reflections exactly as in the photo.',
  },
];

// Whole words with an optional plural, so "ash" does not match "ashtray" or "wire" "wireless".
const hasWord = (haystack: string, keyword: string) =>
  new RegExp(`(^|[^\\p{L}])${keyword}(e?s)?($|[^\\p{L}])`, 'u').test(haystack);

// Every material the name and note mention, most mentioned first, at most three so the prompt
// stays short. Empty when none match: the photo alone then decides.
export function selectMaterialsFrom(
  materials: MaterialProfile[],
  ...texts: (string | null | undefined)[]
): MaterialProfile[] {
  const haystack = texts.filter(Boolean).join(' ').toLowerCase();
  if (!haystack) return [];
  return materials
    .map((material) => ({
      material,
      hits: material.keywords.filter((keyword) => hasWord(haystack, keyword)).length,
    }))
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .map(({ material }) => material);
}

export const selectMaterials = (...texts: (string | null | undefined)[]) =>
  selectMaterialsFrom(MATERIALS, ...texts);

// One paragraph for the sheet prompt, or an empty string when no material is known.
export function materialRules(materials: MaterialProfile[]): string {
  if (materials.length === 0) return '';
  return `Material realism, so a designer can build this: ${materials
    .map((material) => `${material.label}: ${material.guidance}`)
    .join(' ')}`;
}
