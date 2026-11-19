import { moveRenders } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

// Body: { "renderIds": string[], "folderId": string | null }. Files renders in a folder, or
// unfiles them with null. Only the signed-in person's own renders and folders count.
export const POST = (request: Request) =>
  apiHandle(request, async () => {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    return NextResponse.json({
      moved: await moveRenders(user.id, body?.renderIds, body?.folderId),
    });
  });

export const OPTIONS = apiOptions;
