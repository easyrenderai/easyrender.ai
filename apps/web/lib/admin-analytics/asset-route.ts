import 'server-only';
import { AppError } from '@easyrender/core';
import {
  adminDecision,
  readAdminAsset,
  signAdminAsset,
  verifyAdminAsset,
} from '@easyrender/core/admin-analytics';
import { errorResponse } from '@/lib/http';
import { adminSession } from './session';

export async function adminAssetResponse(
  request: Request,
  id: string,
  asset: string,
  isFile: boolean,
) {
  let response: Response;
  try {
    const session = await adminSession(request.headers);
    const decision = adminDecision(session?.user ?? null, process.env.ADMIN_EMAILS ?? '', true);
    if (decision !== 'allow')
      throw new AppError(
        'Administrator access required',
        decision === 'signin' ? 401 : 403,
        'unauthorized',
      );
    if (!isFile) {
      // Renew on click; idle tabs do not keep unusable model/download links.
      response = new Response(null, {
        status: 307,
        headers: { location: signAdminAsset(id, asset) },
      });
    } else {
      verifyAdminAsset(id, asset, new URL(request.url).searchParams);
      const file = await readAdminAsset(id, asset, request.signal);
      response = new Response(file.body, {
        headers: {
          'content-type': file.contentType,
          'content-disposition': `${file.isDownload ? 'attachment' : 'inline'}; filename="render-${encodeURIComponent(id)}-${asset}.${file.extension}"`,
        },
      });
    }
  } catch (error) {
    response = errorResponse(error);
  }
  response.headers.set('cache-control', 'private, no-store');
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('referrer-policy', 'no-referrer');
  response.headers.set('x-robots-tag', 'noindex, nofollow');
  return response;
}
