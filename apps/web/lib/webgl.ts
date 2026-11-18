// Whether this browser can create a WebGL context. Google's <model-viewer> leaves its AR renderer
// null when it cannot, and then throws "Cannot read properties of null (reading
// 'supportsPresentation')" from its async AR mode selection, which no caller can catch. So the
// viewer only asks for AR when a context exists. Browser only; the answer is cached.
let cached: boolean | null = null;

export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    // Hand the probe context back at once: browsers cap how many contexts a page may hold.
    if (context) context.getExtension('WEBGL_lose_context')?.loseContext();
    cached = Boolean(context);
  } catch {
    cached = false;
  }
  return cached;
}

// For tests: forget the cached answer.
export function resetWebGLProbe() {
  cached = null;
}

// Thrown when a 3D section starts in a browser that cannot create a WebGL context. The page keeps
// its still images, so callers treat this as "no 3D here" and stay quiet instead of reporting it.
export class WebGLUnavailableError extends Error {
  constructor() {
    super('WebGL is not available');
    this.name = 'WebGLUnavailableError';
  }
}
