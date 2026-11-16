import { AppError, firstModelOffer } from '@easyrender/core';
import { resolveActor } from '@/lib/actor';
import { apiHandle } from '@/lib/api-http';

export const POST = (request: Request, { params }: RouteContext<'/api/renders/[id]/trial'>) =>
  apiHandle(request, async () => {
    if (request.headers.get('origin') !== new URL(request.url).origin)
      throw new AppError('Same-origin request required', 403, 'unauthorized_origin');
    const { id } = await params;
    return Response.json(await firstModelOffer(id, await resolveActor(request.headers)));
  });
