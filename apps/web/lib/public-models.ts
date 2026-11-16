// Showcase and studio files under public/ are cached for a day and may be
// served stale for a week (STATIC_MEDIA_PATHS in next.config.ts). The path
// does not change when the bytes do. The query makes a replaced file a
// different response. Bump the matching version when those bytes change again.
export const PUBLIC_MODEL_VERSION = 2;
// The armchair source photo was 720 px and went soft on a retina desktop.
export const PUBLIC_PHOTO_VERSION = 3;

export function versionedPublicModel(path: string): string {
  if (path.endsWith('.glb')) return `${path}?v=${PUBLIC_MODEL_VERSION}`;
  if (path === '/showcase/armchair.jpg') return `${path}?v=${PUBLIC_PHOTO_VERSION}`;
  return path;
}
