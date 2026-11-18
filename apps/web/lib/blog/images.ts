// The images a guide may show, with their real pixel size. next/image needs width and height to
// reserve the space before the file loads, and a guide must never pass off a picture as easyrender
// output when it is not (decisiones/claims.md). So the list is closed: a path that is not here is
// rendered as plain text, which makes it obvious in review, and a test fails.
//
// They come from public/showcase (see lib/showcase.ts): the input photos of the demo renders and
// the free angle sheets the easyrender harness drew from them, unretouched. The files under
// public/blog/figures/{guide} are plain crops of those same assets, or a texture copied byte for
// byte out of a showcase GLB, so one asset file is never shown in two guides (content.test.ts).
// A crop's caption says what it is cropped from.

export type BlogImage = { width: number; height: number };

/** Match BlogPostView / CompareView: page gutters, TOC and its gap, then the media grid gap. */
export function blogImageLayout(nativeWidth: number, isGrid: boolean) {
  // Large artwork keeps filling the column. Smaller sources get two source pixels per CSS pixel.
  const maxWidth = nativeWidth < 1440 ? nativeWidth / 2 : undefined;
  const slot = (width: string) => (maxWidth ? `min(${maxWidth}px, ${width})` : width);
  const sizes = isGrid
    ? [
        `(min-width: 1280px) ${slot('376px')}`,
        `(min-width: 1152px) ${slot('392px')}`,
        `(min-width: 1024px) ${slot('calc(50vw - 184px)')}`,
        `(min-width: 640px) ${slot('calc(50vw - 32px)')}`,
        slot('calc(50vw - 22px)'),
      ]
    : [
        `(min-width: 1280px) ${slot('768px')}`,
        `(min-width: 1152px) ${slot('800px')}`,
        `(min-width: 1024px) ${slot('calc(100vw - 352px)')}`,
        `(min-width: 640px) ${slot('calc(100vw - 48px)')}`,
        slot('calc(100vw - 32px)'),
      ];
  return { maxWidth, sizes: sizes.join(', ') };
}

export const BLOG_IMAGES: Record<string, BlogImage> = {
  '/showcase/armchair.jpg': { width: 2048, height: 2048 },
  '/showcase/armchair-angles.jpg': { width: 1200, height: 1200 },
  '/showcase/vase.jpg': { width: 720, height: 720 },
  '/showcase/swivel-chair.jpg': { width: 720, height: 720 },
  '/showcase/bedside-table.jpg': { width: 720, height: 720 },
  '/showcase/vase-angles.jpg': { width: 1200, height: 1200 },
  // Two cells of /showcase/armchair-angles.jpg: the predicted front and three-quarter views.
  '/blog/figures/product-photography-for-ecommerce/armchair-front.jpg': { width: 388, height: 388 },
  '/blog/figures/product-photography-for-ecommerce/armchair-three-quarter.jpg': {
    width: 388,
    height: 388,
  },
  // The base colour texture inside /showcase/clay-vase.glb, copied out of the file unchanged.
  '/blog/figures/glb-file/clay-vase-texture.webp': { width: 1024, height: 1024 },
  '/blog/figures/n8n-product-pages-images-3d/n8n-ficha-foto-vistas-modelo.jpg': {
    width: 1200,
    height: 400,
  },
  '/blog/figures/n8n-product-pages-images-3d/workflow-en.webp': { width: 1280, height: 720 },
  '/blog/figures/n8n-product-pages-images-3d/workflow-es.webp': { width: 1280, height: 720 },

  // Drawn illustrations, see ILLUSTRATION_DIR below.
  '/blog/illustrations/n8n-product-pages-images-3d/hero.webp': { width: 1280, height: 720 },
  '/blog/illustrations/how-to-make-a-3d-model-from-photos/hero.webp': { width: 1280, height: 720 },
  '/blog/illustrations/product-photography-for-ecommerce/hero.webp': { width: 1280, height: 720 },
  '/blog/illustrations/3d-models-for-ecommerce/hero.webp': { width: 1280, height: 720 },
  '/blog/illustrations/sell-vintage-furniture-online/hero.webp': { width: 1280, height: 720 },
  '/blog/illustrations/sell-vintage-furniture-online/courier-prep.webp': {
    width: 1500,
    height: 1008,
  },
  '/blog/illustrations/glb-file/hero.webp': { width: 1280, height: 720 },
  '/blog/illustrations/how-to-make-a-3d-model/hero.webp': { width: 1280, height: 720 },
  '/blog/illustrations/usdz-file/hero.webp': { width: 1280, height: 720 },

  // Style A2 heroes for the compare review pages. Same 16:9 1280x720 WebP convention
  // as the guides; they live under /compare/illustrations so they are not mixed
  // with blog heroes. Registered here so Markdown can render them.
  '/compare/illustrations/3d-modeler-vs-ai/hero.webp': { width: 1280, height: 720 },
  '/compare/illustrations/360-vs-3d/hero.webp': { width: 1280, height: 720 },
  '/compare/illustrations/photogrammetry-software/hero.webp': { width: 1280, height: 720 },
  '/compare/illustrations/meshy/hero.webp': { width: 1280, height: 720 },
  '/compare/illustrations/tripo/hero.webp': { width: 1280, height: 720 },
  // Unedited screenshots of downloaded competitor GLBs in an external viewer.
  '/benchmarks/2026-11-15/meshy-viewer.jpg': { width: 1512, height: 750 },
  '/benchmarks/2026-11-15/tripo-viewer.jpg': { width: 1512, height: 750 },
};

// Illustrations in the house style, Style A2: a dark, technical 3D render of one object, half in
// its real material and half in matte grey clay with a fine white wireframe mesh, white rim light,
// charcoal-to-black radial gradient background, dark glossy floor with a contact shadow, and a
// single accent colour from the real material. 16:9, 1280x720 WebP. A different object in every
// guide, never the home demo objects (the armchair). Generated with an image model on request
// (prompt in the post's brief, docs/blog/PIPELINE.md) and never a product result: no text, no UI,
// no logos, no numbers or measurements. Every
// guide opens with one directly under its first paragraph, at least 1200 pixels wide, and it is
// also the guide's BlogPosting and Open Graph image (schemaImage below). Its caption says it is
// an illustration, so it cannot be mistaken for easyrender output. content.test.ts checks all of
// it, and that no illustration appears in two guides.
export const ILLUSTRATION_DIR = '/blog/illustrations/';

export const isIllustration = (src: string): boolean => src.startsWith(ILLUSTRATION_DIR);

// Diagrams drawn for the guides, as React components (components/blog/diagrams). They are
// rendered on the server as inline HTML and SVG on the site's colour tokens, so they read
// without JavaScript and follow the light or dark scheme. Written `![alt](diagram:name "caption")`.
// The size is the box the diagram is drawn for, kept only so a diagram parses like an image.
export const DIAGRAM_PREFIX = 'diagram:';

export const BLOG_DIAGRAMS: readonly string[] = [
  'photo-vs-photogrammetry',
  'image-to-3d-pipeline',
  'window-light-setup',
  'camera-height',
  'lens-distance',
  'store-files',
  'sideboard-photo-pick',
  'vintage-shot-list',
  'listing-title',
  'glb-anatomy',
  'method-decision-tree',
  'photogrammetry-rings',
  'blockout-side-table',
  'usdz-anatomy',
  'quick-look-path',
];
const DIAGRAM_SIZE: BlogImage = { width: 720, height: 405 };

// The 3D models a guide may embed, from the same closed source: the GLBs in public/showcase are
// easyrender output from one photo (see lib/showcase.ts), with their textures compressed to WebP
// by glTF Transform for the web. Each one has a poster: a still of that same GLB in model-viewer,
// with the camera at `orbit`, captured in headless Chromium and not edited. The poster is in the
// server HTML, so a crawler or a reader without JavaScript sees the model and its caption; the
// viewer replaces it once it has loaded, from the same starting camera, so nothing jumps.
export type BlogModel = { poster: string; width: number; height: number; orbit: string };

export const BLOG_MODELS: Record<string, BlogModel> = {
  '/showcase/armchair.glb': {
    poster: '/blog/models/armchair.webp',
    width: 960,
    height: 960,
    orbit: '30deg 75deg auto',
  },
  '/showcase/swivel-chair.glb': {
    poster: '/blog/models/swivel-chair.webp',
    width: 960,
    height: 960,
    orbit: '30deg 75deg auto',
  },
  '/showcase/bedside-table.glb': {
    poster: '/blog/models/bedside-table.webp',
    width: 960,
    height: 960,
    orbit: '-60deg 75deg auto',
  },
  '/showcase/clay-vase.glb': {
    poster: '/blog/models/clay-vase.webp',
    width: 960,
    height: 960,
    orbit: '30deg 75deg auto',
  },
  '/showcase/coffee-table.glb': {
    poster: '/blog/models/coffee-table.webp',
    width: 960,
    height: 960,
    orbit: '30deg 75deg auto',
  },
  '/showcase/vase.glb': {
    poster: '/blog/models/vase.webp',
    width: 960,
    height: 960,
    orbit: '30deg 75deg auto',
  },
};

const IMAGE = /!\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/;

/**
 * `![alt](/path "caption")`, or null when the line is not exactly one image. A path in BLOG_MODELS
 * is a 3D model: `model` holds its poster and `size` the poster's size. A `diagram:` path in
 * BLOG_DIAGRAMS is a drawn diagram, with `diagram` set to its name.
 */
export function parseImage(line: string): {
  alt: string;
  src: string;
  caption?: string;
  size: BlogImage | null;
  model?: BlogModel;
  diagram?: string;
} | null {
  const match = new RegExp(`^${IMAGE.source}$`).exec(line.trim());
  if (!match) return null;
  const src = match[2] as string;
  const model = BLOG_MODELS[src];
  const name = src.startsWith(DIAGRAM_PREFIX) ? src.slice(DIAGRAM_PREFIX.length) : null;
  if (name !== null) {
    const isKnown = BLOG_DIAGRAMS.includes(name);
    return {
      alt: match[1] as string,
      src,
      ...(match[3] ? { caption: match[3] } : {}),
      size: isKnown ? DIAGRAM_SIZE : null,
      ...(isKnown ? { diagram: name } : {}),
    };
  }
  return {
    alt: match[1] as string,
    src,
    ...(match[3] ? { caption: match[3] } : {}),
    size: model ? { width: model.width, height: model.height } : (BLOG_IMAGES[src] ?? null),
    ...(model ? { model } : {}),
  };
}

// Google asks for article images at least 1200 pixels wide, so smaller ones stay in the body only.
export const MIN_SCHEMA_WIDTH = 1200;

/**
 * The first known image of a post body wide enough for the BlogPosting and Open Graph image, or
 * null. Every guide opens with its illustration, so that is the one it finds.
 */
export function schemaImage(body: string): { src: string; width: number; height: number } | null {
  for (const line of body.split('\n')) {
    const image = parseImage(line);
    if (image?.size && !image.model && !image.diagram && image.size.width >= MIN_SCHEMA_WIDTH)
      return { src: image.src, ...image.size };
  }
  return null;
}
