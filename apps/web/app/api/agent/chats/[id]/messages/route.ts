import { AppError } from '@easyrender/core';
import { sendAgentMessage } from '@easyrender/mcp/agent';
import { agentActor, agentEventStream, requireAgentTurn } from '@/lib/agent-api';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// Body: { "text": string, "uploadId"?: string }. Runs one turn and streams it as server-sent events.
export const POST = (
  request: Request,
  { params }: RouteContext<'/api/agent/chats/[id]/messages'>,
) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const { actor } = await agentActor(request);
    const body = await request.json().catch(() => null);
    if (
      typeof body?.text !== 'string' ||
      (body.uploadId !== undefined && typeof body.uploadId !== 'string')
    ) {
      throw new AppError('Send { "text": string, "uploadId"?: string }', 400, 'bad_body');
    }
    await requireAgentTurn(actor.userId);
    return agentEventStream((emit) =>
      sendAgentMessage({
        actor,
        chatId: id,
        text: body.text,
        uploadId: body.uploadId,
        emit,
        deps: {},
      }),
    );
  });

export const OPTIONS = apiOptions;
