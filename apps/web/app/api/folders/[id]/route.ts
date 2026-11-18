import { deleteFolder, renameFolder } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

// Body: { "name": string }. Renames the folder.
export const PATCH = (request: Request, { params }: RouteContext<'/api/folders/[id]'>) =>
  apiHandle(request, async () => {
    const user = await requireUser();
    const { id } = await params;
    const body = await request.json().catch(() => null);
    return NextResponse.json(await renameFolder(user.id, id, body?.name));
  });

// Deletes the folder. Its renders stay in the library, unfiled.
export const DELETE = (request: Request, { params }: RouteContext<'/api/folders/[id]'>) =>
  apiHandle(request, async () => {
    const user = await requireUser();
    const { id } = await params;
    await deleteFolder(user.id, id);
    return new Response(null, { status: 204 });
  });

export const OPTIONS = apiOptions;
