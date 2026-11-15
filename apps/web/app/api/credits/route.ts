import { AppError, getCreditQuote } from '@easyrender/core';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const GET = (request: Request) =>
  apiHandle(request, async () => {
    const actor = await resolveActor(request.headers);
    if (!actor.userId) throw new AppError('Authentication required', 401, 'unauthorized');
    return Response.json(await getCreditQuote({ ...actor, userId: actor.userId }));
  });
export const OPTIONS = apiOptions;
