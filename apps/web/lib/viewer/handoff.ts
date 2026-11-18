// Files the converter hands to the viewer when the visitor asks to see the model in 3D. The move
// between the two pages is a client navigation, so the files stay in memory and are never
// uploaded or dropped a second time. Taken once: a reload starts with an empty viewer.
let pending: File[] | null = null;

export function handOffFiles(files: readonly File[]) {
  pending = [...files];
}

export function takeHandedOffFiles(): File[] | null {
  const files = pending;
  pending = null;
  return files;
}
