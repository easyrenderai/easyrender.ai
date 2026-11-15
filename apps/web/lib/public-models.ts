// Showcase and studio GLBs are cached for a day and may be served stale for a
// week (STATIC_MEDIA_PATHS in next.config.ts). The path does not change when
// the bytes do, so a browser that already fetched the olive armchair keeps
// painting that chartreuse fabric. The query makes the corrected file a
// different response. Bump this when a public GLB is replaced again.
export const PUBLIC_MODEL_VERSION = 2;

export function versionedPublicModel(path: string): string {
  if (!path.endsWith('.glb')) return path;
  return `${path}?v=${PUBLIC_MODEL_VERSION}`;
}
