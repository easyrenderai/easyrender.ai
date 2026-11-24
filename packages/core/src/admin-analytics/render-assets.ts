import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '@easyrender/db';
import { AppError } from '../errors';
import { getFileStream } from '../storage';

const ASSETS = ['preview', 'source', 'sheet', 'glb', 'view'] as const;
type Asset = (typeof ASSETS)[number];
const TTL_SECONDS = 300;

function assetType(value: string): Asset {
  if (!ASSETS.includes(value as Asset)) throw new AppError('Asset not found', 404, 'not_found');
  return value as Asset;
}
function signature(id: string, asset: string, expires: number) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new AppError('Asset signing unavailable', 503, 'not_configured');
  // A separate domain prevents reuse of any authentication token signed with this secret.
  return createHmac('sha256', secret)
    .update(JSON.stringify(['admin-render-asset-v1', id, asset, expires]))
    .digest('hex');
}
/** Call only after verifying the admin session. Contains no storage key or owner email. */
export function signAdminAsset(id: string, asset: string, now = Date.now()): string {
  assetType(asset);
  const expires = Math.floor(now / 1000) + TTL_SECONDS;
  return `/api/admin/renders/${encodeURIComponent(id)}/files/${asset}?expires=${expires}&signature=${signature(id, asset, expires)}`;
}
export function verifyAdminAsset(
  id: string,
  asset: string,
  params: URLSearchParams,
  now = Date.now(),
): void {
  assetType(asset);
  const expires = Number(params.get('expires'));
  const supplied = params.get('signature') ?? '';
  const seconds = Math.floor(now / 1000);
  if (
    !Number.isSafeInteger(expires) ||
    expires <= seconds ||
    expires > seconds + TTL_SECONDS ||
    !/^[a-f0-9]{64}$/.test(supplied)
  ) {
    throw new AppError('Asset link expired or invalid', 403, 'invalid_asset_link');
  }
  if (
    !timingSafeEqual(
      Buffer.from(signature(id, asset, expires), 'hex'),
      Buffer.from(supplied, 'hex'),
    )
  ) {
    throw new AppError('Asset link expired or invalid', 403, 'invalid_asset_link');
  }
}

/** Read stored files only: no polling, optimizing, exporting, database writes or upstream redirects. */
export async function readAdminAsset(id: string, rawAsset: string, signal?: AbortSignal) {
  const asset = assetType(rawAsset);
  const render = await db().render.findUnique({
    where: { id },
    select: {
      sourceKey: true,
      sheetKey: true,
      glbKey: true,
      viewGlbKey: true,
    },
  });
  const key =
    render &&
    (asset === 'preview'
      ? render.sheetKey || render.sourceKey
      : asset === 'source'
        ? render.sourceKey
        : asset === 'sheet'
          ? render.sheetKey
          : asset === 'view'
            ? render.viewGlbKey || render.glbKey
            : render.glbKey);
  if (!key) throw new AppError('Asset not found', 404, 'not_found');
  const base = process.env.ASSETS_CDN_URL?.replace(/\/+$/, '');
  // Storage currently records CDN URLs. Keep them server-side and reject arbitrary URLs/SSRF.
  const isLocal = key.startsWith('local:') && !process.env.VERCEL;
  if (!isLocal) {
    if (!base || !key.startsWith(`${base}/renders/`))
      throw new AppError('Asset unavailable', 404, 'not_found');
    const url = new URL(key);
    if (
      url.protocol !== 'https:' ||
      url.origin !== new URL(base).origin ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      !url.pathname.startsWith(`${new URL(base).pathname.replace(/\/+$/, '')}/renders/`)
    ) {
      throw new AppError('Asset unavailable', 404, 'not_found');
    }
  }
  const isModel = asset === 'glb' || asset === 'view';
  const extension = isModel ? 'glb' : key.split('.').at(-1)?.toLowerCase();
  const contentTypes: Record<string, string> = {
    glb: 'model/gltf-binary',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  };
  const contentType = extension && contentTypes[extension];
  if (!contentType) throw new AppError('Asset format unavailable', 404, 'not_found');
  const body = await getFileStream(key, {
    redirect: 'error',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
      : AbortSignal.timeout(60_000),
  });
  return {
    body,
    contentType,
    extension,
    isDownload: asset === 'glb' || asset === 'sheet' || asset === 'source',
  };
}
