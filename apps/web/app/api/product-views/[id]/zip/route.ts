import { zipViewSet } from '@easyrender/core';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// Every finished view in one ZIP.
export const GET = (request: Request, { params }: RouteContext<'/api/product-views/[id]/zip'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const { bytes, filename } = await zipViewSet(id, await resolveActor(request.headers));
    return new Response(bytes as BodyInit, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'private, no-store',
      },
    });
  });

export const OPTIONS = apiOptions;
