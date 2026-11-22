import { createAgentChat, listAgentChats } from '@easyrender/core';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/actor';
import { apiHandle, apiOptions } from '@/lib/api-http';

// The signed-in person's chats with the agent, latest first.
export const GET = (request: Request) =>
  apiHandle(request, async () => {
    const user = await requireUser();
    return NextResponse.json({ chats: await listAgentChats(user.id) });
  });

export const POST = (request: Request) =>
  apiHandle(request, async () => {
    const user = await requireUser();
    return NextResponse.json(await createAgentChat(user.id), { status: 201 });
  });

export const OPTIONS = apiOptions;
