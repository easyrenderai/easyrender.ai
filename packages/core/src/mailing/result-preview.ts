import sharp from 'sharp';
import { getFileStream } from '../storage';

const MAX_COMPARISON_BYTES = 512 * 1024;

function isStoredComparison(key: string): boolean {
  if (key.startsWith('local:')) return /^local:quality\/comparison-[\w-]+\.png$/.test(key);
  const base = process.env.ASSETS_CDN_URL?.replace(/\/+$/, '');
  if (!base) return false;
  const prefix = `${base}/renders/quality/`;
  return key.startsWith(prefix) && /^comparison-[\w-]+\.png$/.test(key.slice(prefix.length));
}

/** The fidelity comparison contains the source on the left and the finished GLB on the right. */
export async function renderEmailPreview(key: string): Promise<Buffer | null> {
  if (!isStoredComparison(key)) return null;
  try {
    const reader = (
      await getFileStream(key, { signal: AbortSignal.timeout(2000), redirect: 'error' })
    ).getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_COMPARISON_BYTES) return null;
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const image = sharp(Buffer.concat(chunks), { limitInputPixels: 1024 * 1024 });
    const { width, height, format } = await image.metadata();
    if (!height || width !== height * 2 || format !== 'png') return null;
    return await image
      .extract({ left: height, top: 0, width: height, height })
      .flatten({ background: '#eeeeee' })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    // A preview is optional. The recipient can still open the finished project.
    return null;
  }
}
