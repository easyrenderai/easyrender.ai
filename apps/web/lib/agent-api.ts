import 'server-only';
import { type Actor, AppError, consumeApiRateLimit, reportError } from '@easyrender/core';
import { type AgentEvent, agentAvailable } from '@easyrender/mcp/agent';
import { privacyRegion } from '@/lib/analytics/privacy-region';
import { requireUser } from './actor';

// Turns a person may start per minute. A turn is several model calls, so this is a cost guard,
// not a chat limit.
const TURNS_PER_MINUTE = 20;

// The signed-in person and the actor the agent's tools run as. Browser sessions only: an API key
// has the MCP server and the REST API, and does not get the chat.
export async function agentActor(
  request: Request,
): Promise<{ user: { id: string }; actor: Actor & { userId: string } }> {
  const user = await requireUser();
  return {
    user,
    actor: { userId: user.id, geoCountry: privacyRegion(request.headers).country },
  };
}

export async function requireAgentTurn(userId: string) {
  if (!agentAvailable()) {
    throw new AppError('The agent is not available right now', 503, 'agent_unavailable');
  }
  await consumeApiRateLimit(`agent:${userId}`, TURNS_PER_MINUTE);
}

// A turn as server-sent events: text as it is written, tool progress, the approvals it waits
// for, and a last `done` (or `error`) event.
export function agentEventStream(
  run: (emit: (event: AgentEvent) => void) => Promise<unknown>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let isOpen = true;
      const emit = (event: AgentEvent) => {
        if (!isOpen) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // The reader went away. The turn still finishes and is stored.
          isOpen = false;
        }
      };
      try {
        await run(emit);
      } catch (error) {
        if (error instanceof AppError) {
          emit({ type: 'error', code: error.code, message: error.message });
        } else {
          reportError(error, { stage: 'agent-turn' });
          emit({ type: 'error', code: 'internal', message: 'Something went wrong' });
        }
      } finally {
        if (isOpen) controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
