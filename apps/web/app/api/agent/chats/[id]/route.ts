import { deleteAgentChat, getAgentChat } from '@easyrender/core';
import { pendingApprovals } from '@easyrender/mcp/agent';
import { NextResponse } from 'next/server';
import { agentActor } from '@/lib/agent-api';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 30;

// A chat with its messages, and the approvals it is waiting on at today's price.
export const GET = (request: Request, { params }: RouteContext<'/api/agent/chats/[id]'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const { actor } = await agentActor(request);
    const chat = await getAgentChat(actor.userId, id);
    return NextResponse.json({ ...chat, approvals: await pendingApprovals(actor, id) });
  });

export const DELETE = (request: Request, { params }: RouteContext<'/api/agent/chats/[id]'>) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const { actor } = await agentActor(request);
    await deleteAgentChat(actor.userId, id);
    return new Response(null, { status: 204 });
  });

export const OPTIONS = apiOptions;
