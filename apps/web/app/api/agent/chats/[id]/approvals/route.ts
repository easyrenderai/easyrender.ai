import { AppError } from '@easyrender/core';
import { resolveAgentApproval } from '@easyrender/mcp/agent';
import { agentActor, agentEventStream, requireAgentTurn } from '@/lib/agent-api';
import { apiHandle, apiOptions } from '@/lib/api-http';

export const maxDuration = 60;

// Body: { "toolUseId": string, "decision": "approve" | "decline" }. Approving runs the step the
// agent asked for at the price shown; the answer streams like a message.
export const POST = (
  request: Request,
  { params }: RouteContext<'/api/agent/chats/[id]/approvals'>,
) =>
  apiHandle(request, async () => {
    const { id } = await params;
    const { actor } = await agentActor(request);
    const body = await request.json().catch(() => null);
    if (
      typeof body?.toolUseId !== 'string' ||
      (body.decision !== 'approve' && body.decision !== 'decline')
    ) {
      throw new AppError(
        'Send { "toolUseId": string, "decision": "approve" | "decline" }',
        400,
        'bad_body',
      );
    }
    await requireAgentTurn(actor.userId);
    return agentEventStream((emit) =>
      resolveAgentApproval({
        actor,
        chatId: id,
        toolUseId: body.toolUseId,
        decision: body.decision,
        emit,
        deps: {},
      }),
    );
  });

export const OPTIONS = apiOptions;
