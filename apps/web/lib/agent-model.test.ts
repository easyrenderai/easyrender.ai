import { openToolbox } from '@easyrender/mcp/agent';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import {
  AGENT_ERROR_CODES,
  AGENT_TOOL_NAMES,
  agentErrorCode,
  readEvents,
  type StoredMessage,
  toRows,
} from './agent-model';

const message = (
  id: string,
  role: 'user' | 'assistant',
  content: unknown[],
  credits = 0,
): StoredMessage => ({ id, role, content, credits });

describe('toRows', () => {
  it('shows what the person wrote and hides the photo line', () => {
    const rows = toRows([
      message('1', 'user', [
        { type: 'text', text: 'Photo attached, upload_id: up_123' },
        { type: 'text', text: 'Make this a 3D model' },
      ]),
    ]);
    expect(rows).toEqual([
      {
        id: '1',
        role: 'user',
        text: 'Make this a 3D model',
        hasPhoto: true,
        parts: [],
        credits: 0,
      },
    ]);
  });

  it('does not draw a bubble for tool results', () => {
    const rows = toRows([
      message('1', 'user', [{ type: 'tool_result', tool_use_id: 't1', content: '{}' }]),
    ]);
    expect(rows).toEqual([]);
  });

  it('reads one turn of several model messages as one answer with its tool cards', () => {
    const rows = toRows([
      message('1', 'user', [{ type: 'text', text: 'hi' }]),
      message('2', 'assistant', [
        { type: 'text', text: 'Starting the preview.' },
        { type: 'tool_use', id: 't1', name: 'create_render', input: {} },
      ]),
      message('3', 'user', [
        {
          type: 'tool_result',
          tool_use_id: 't1',
          content: JSON.stringify({ id: 'r1', status: 'preview_ready', hasSheet: true }),
        },
      ]),
      message('4', 'assistant', [{ type: 'text', text: 'The angles look consistent.' }], 2),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      role: 'assistant',
      credits: 2,
      // Words and cards stay in the order the agent wrote them.
      parts: [
        { kind: 'text', text: 'Starting the preview.' },
        {
          kind: 'tool',
          tool: {
            id: 't1',
            name: 'create_render',
            status: 'done',
            renderId: 'r1',
            renderStatus: 'preview_ready',
            hasSheet: true,
          },
        },
        { kind: 'text', text: 'The angles look consistent.' },
      ],
    });
  });

  it('marks a call with no result as waiting and a failed one with its error code', () => {
    const rows = toRows([
      message('1', 'assistant', [
        { type: 'tool_use', id: 't1', name: 'render_3d', input: {} },
        { type: 'tool_use', id: 't2', name: 'get_render', input: {} },
      ]),
      message('2', 'user', [
        {
          type: 'tool_result',
          tool_use_id: 't2',
          is_error: true,
          content: JSON.stringify({ error: { code: 'not_found', message: 'x' } }),
        },
      ]),
    ]);
    expect(rows[0]?.parts).toMatchObject([
      { kind: 'tool', tool: { id: 't1', status: 'waiting' } },
      { kind: 'tool', tool: { id: 't2', status: 'error', errorCode: 'not_found' } },
    ]);
  });
});

describe('readEvents', () => {
  it('parses events split across chunks and skips a broken frame', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"type":"text","delta":"Hel',
      'lo"}\n\ndata: not json\n\n',
      'data: {"type":"done","credits":1}\n\n',
    ];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    });
    const seen: unknown[] = [];
    await readEvents(new Response(body), (event) => seen.push(event));
    expect(seen).toEqual([
      { type: 'text', delta: 'Hello' },
      { type: 'done', credits: 1 },
    ]);
  });
});

describe('copy for the agent', () => {
  it('has a label for every tool the agent is offered', async () => {
    const toolbox = await openToolbox({ userId: 'u1' });
    try {
      const offered = toolbox.tools.map((tool) => tool.name).sort();
      expect(
        offered.filter((name) => !(AGENT_TOOL_NAMES as readonly string[]).includes(name)),
      ).toEqual([]);
    } finally {
      await toolbox.close();
    }
    expect(Object.keys(en.Agent.tools).sort()).toEqual([...AGENT_TOOL_NAMES].sort());
  });

  it('has a message for every error code and shows an unknown one as the general error', () => {
    expect(Object.keys(en.Agent.errors).sort()).toEqual([...AGENT_ERROR_CODES].sort());
    expect(agentErrorCode('something_new')).toBe('internal');
    expect(agentErrorCode('insufficient_credits')).toBe('insufficient_credits');
  });
});
