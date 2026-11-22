// What the chat page draws, read from the messages as they are stored: the model's own content
// blocks. Pure functions, so the rules (what is a bubble, what is a tool card) are tested apart
// from the screen.

type Block = { type: string; [key: string]: unknown };
export type StoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: unknown[];
  credits: number;
};

// The tools the chat has a label for. A tool the agent is offered but is missing here is shown by
// its own name; agent-model.test.ts fails when the MCP server grows one without a label.
export const AGENT_TOOL_NAMES = [
  'create_render',
  'get_render',
  'render_3d',
  'rebuild_standard',
  'get_credits',
  'list_renders',
  'set_render_visibility',
  'start_render_sheet',
  'redraw_render_sheet',
  'upscale_image',
  'get_upscale',
  'create_product_views',
  'get_product_views',
  'list_product_views',
  'list_upscales',
  'polish_product_view',
  'build_from_product_views',
] as const;
export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];
export const isAgentToolName = (value: string): value is AgentToolName =>
  (AGENT_TOOL_NAMES as readonly string[]).includes(value);

export const AGENT_ERROR_CODES = [
  'insufficient_credits',
  'agent_unavailable',
  'rate_limit',
  'upload_failed',
  'chat_full',
  'internal',
] as const;
export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[number];
// Any other code is shown as the general error.
export const agentErrorCode = (code: string): AgentErrorCode =>
  (AGENT_ERROR_CODES as readonly string[]).includes(code) ? (code as AgentErrorCode) : 'internal';

type ToolStatus = 'waiting' | 'done' | 'error';
export type ToolView = {
  id: string;
  name: string;
  status: ToolStatus;
  // Set when the tool's answer was a render, so the card can show its preview.
  renderId?: string;
  hasSheet?: boolean;
  renderStatus?: string;
  errorCode?: string;
};
// An answer reads in the order the agent wrote it: a line, a tool card, the next line.
type Part = { kind: 'text'; text: string } | { kind: 'tool'; tool: ToolView };
export type Row = {
  id: string;
  role: 'user' | 'assistant';
  // The person's words. An answer keeps its words in `parts`.
  text: string;
  hasPhoto: boolean;
  parts: Part[];
  credits: number;
};

const PHOTO_LINE = /^Photo attached, upload_id: \S+\n?/;

const isBlock = (value: unknown): value is Block =>
  typeof value === 'object' && value !== null && typeof (value as Block).type === 'string';

function parseResult(content: unknown): Record<string, unknown> | null {
  const raw = typeof content === 'string' ? content : null;
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function toolView(block: Block, results: Map<string, Block>): ToolView {
  const id = String(block.id);
  const result = results.get(id);
  const data = result ? parseResult(result.content) : null;
  const failure =
    data && typeof data.error === 'object' ? (data.error as { code?: unknown }) : null;
  return {
    id,
    name: String(block.name),
    status: !result ? 'waiting' : result.is_error === true ? 'error' : 'done',
    ...(data && typeof data.id === 'string' && typeof data.status === 'string'
      ? { renderId: data.id, renderStatus: data.status, hasSheet: data.hasSheet === true }
      : {}),
    ...(failure && typeof failure.code === 'string' ? { errorCode: failure.code } : {}),
  };
}

export function toRows(messages: StoredMessage[]): Row[] {
  const results = new Map<string, Block>();
  for (const message of messages) {
    for (const block of message.content.filter(isBlock)) {
      if (block.type === 'tool_result') results.set(String(block.tool_use_id), block);
    }
  }
  const rows: Row[] = [];
  for (const message of messages) {
    const blocks = message.content.filter(isBlock);
    if (message.role === 'user') {
      let hasPhoto = false;
      const text = blocks
        .filter((block) => block.type === 'text')
        .map((block) => {
          const value = String(block.text ?? '');
          if (PHOTO_LINE.test(value)) hasPhoto = true;
          return value.replace(PHOTO_LINE, '');
        })
        .join('\n')
        .trim();
      // A message that only carries tool results is the agent's own plumbing, not a bubble.
      if (!text && !hasPhoto) continue;
      rows.push({ id: message.id, role: 'user', text, hasPhoto, parts: [], credits: 0 });
      continue;
    }
    const parts: Part[] = [];
    for (const block of blocks) {
      if (block.type === 'text') {
        const text = String(block.text ?? '').trim();
        if (text) parts.push({ kind: 'text', text });
      } else if (block.type === 'tool_use') {
        parts.push({ kind: 'tool', tool: toolView(block, results) });
      }
    }
    // One turn is several model messages. They read as one answer.
    const previous = rows.at(-1);
    if (previous && previous.role === 'assistant') {
      previous.parts.push(...parts);
      previous.credits += message.credits;
    } else {
      rows.push({
        id: message.id,
        role: 'assistant',
        text: '',
        hasPhoto: false,
        parts,
        credits: message.credits,
      });
    }
  }
  return rows;
}

export type AgentStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; id: string; name: string; status: 'running' | 'done' | 'error' }
  | { type: 'approval'; approvals: unknown[] }
  | { type: 'done'; credits: number }
  | { type: 'error'; code: string; message: string };

// Reads a server-sent event stream and hands each event over as it arrives.
export async function readEvents(
  response: Response,
  onEvent: (event: AgentStreamEvent) => void,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end = buffer.indexOf('\n\n');
    while (end !== -1) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = frame
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('');
      if (data) {
        try {
          onEvent(JSON.parse(data) as AgentStreamEvent);
        } catch {
          // A broken frame is skipped; the chat is read again from storage when the turn ends.
        }
      }
      end = buffer.indexOf('\n\n');
    }
  }
}
