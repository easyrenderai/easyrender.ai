import { AppError, createViewSet, getBalance, listViewSets, toViewSetView } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { resolveActor } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';
import { parseApiPhoto } from '@/lib/api-upload';

export const maxDuration = 60;

// Multipart upload: `image` (file), an optional `prompt` and an optional `name`. Charges the set
// and starts drawing its nine views.
export const POST = (request: Request) =>
  apiHandle(request, async () => {
    const actor = await resolveActor(request.headers, 'spend');
    if (!actor.userId) throw new AppError('Sign in to make product views', 401, 'unauthorized');
    const photo = await parseApiPhoto(request, actor);
    const set = await createViewSet({
      actor,
      bytes: photo.bytes,
      contentType: photo.contentType,
      prompt: photo.prompt,
      name: photo.name,
    });
    return NextResponse.json(toViewSetView(set), { status: 201 });
  });

// The signed-in user's product views, newest first.
export const GET = (request: Request) =>
  apiHandle(request, async () => {
    const actor = await resolveActor(request.headers);
    if (!actor.userId) throw new AppError('Sign in to see your product views', 401, 'unauthorized');
    const [sets, balance] = await Promise.all([
      listViewSets(actor.userId),
      getBalance(actor.userId),
    ]);
    return NextResponse.json({ sets: sets.map(toViewSetView), balance });
  });

export const OPTIONS = apiOptions;
