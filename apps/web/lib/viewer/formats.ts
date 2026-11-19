// The 3D files the viewer opens, in the order used to pick the model out of a multi-file drop:
// a .gltf comes with a .bin and textures, an .obj with a .mtl, and those companions are never the
// model itself.
export const VIEWER_FORMATS = [
  'glb',
  'gltf',
  'obj',
  'fbx',
  'stl',
  'ply',
  '3mf',
  'dae',
  'usdz',
  '3ds',
] as const;

export type ViewerFormat = (typeof VIEWER_FORMATS)[number];

// What the open model can be written as. FBX, 3MF, DAE and 3DS are read-only: there is no browser
// exporter for them.
export const EXPORT_FORMATS = ['glb', 'gltf', 'obj', 'stl', 'ply', 'usdz'] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** What the file picker offers. Extensions only: browsers know no MIME type for most of these. */
export const VIEWER_ACCEPT = [
  ...VIEWER_FORMATS.map((format) => `.${format}`),
  '.bin',
  '.mtl',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.ktx2',
].join(',');

/** Above this the browser tab is likely to run out of memory while parsing. */
export const VIEWER_MAX_BYTES = 300 * 1024 * 1024;

// These formats are usually exported with Z pointing up; the viewer stands them upright.
const Z_UP: ReadonlySet<ViewerFormat> = new Set(['stl', '3mf', '3ds']);

export const isZUpFormat = (format: ViewerFormat | ExportFormat) =>
  Z_UP.has(format as ViewerFormat);

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}

export function formatOf(filename: string): ViewerFormat | null {
  const extension = extensionOf(filename);
  return (VIEWER_FORMATS as readonly string[]).includes(extension)
    ? (extension as ViewerFormat)
    : null;
}

/** The model among the dropped files, or null when none of them is a 3D file we open. */
export function pickModelFile<T extends { name: string }>(
  files: readonly T[],
): { file: T; format: ViewerFormat } | null {
  for (const format of VIEWER_FORMATS) {
    const file = files.find((candidate) => formatOf(candidate.name) === format);
    if (file) return { file, format };
  }
  return null;
}

/** The last path segment of a URI a model refers to, lower-cased, without query or fragment. */
export function resourceName(uri: string): string {
  const path = uri.split(/[?#]/)[0];
  const name = path.split(/[\\/]/).pop() ?? '';
  try {
    return decodeURIComponent(name).toLowerCase();
  } catch {
    return name.toLowerCase();
  }
}
