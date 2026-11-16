import { getUpscaleImage } from '@easyrender/core';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// The enlarged picture (a JPEG). `?download=1` saves it as a file.
export const GET = (request: Request, { params }: RouteContext<'/api/upscales/[id]/image'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const { bytes, filename } = await getUpscaleImage(id, await resolveActor(request.headers));
    const isDownload = new URL(request.url).searchParams.get('download') === '1';
    return new Response(bytes as BodyInit, {
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'private, max-age=3600',
        ...(isDownload ? { 'content-disposition': `attachment; filename="${filename}"` } : {}),
      },
    });
  });

export const OPTIONS = apiOptions;
