import { createFolder, listFolders } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

// Library folders belong to a signed-in person and are managed from the browser, not with an API key.
export const GET = (request: Request) =>
  apiHandle(request, async () => {
    const user = await requireUser();
    return NextResponse.json(
      { folders: await listFolders(user.id) },
      { headers: { 'cache-control': 'no-store' } },
    );
  });

// Body: { "name": string }. Creates a folder.
export const POST = (request: Request) =>
  apiHandle(request, async () => {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    return NextResponse.json(await createFolder(user.id, body?.name), { status: 201 });
  });

export const OPTIONS = apiOptions;
