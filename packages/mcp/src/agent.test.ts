import type Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Stored = {
  id: string;
  role: 'user' | 'assistant';
  content: Record<string, unknown>[];
  credits: number;
};
const store = vi.hoisted(() => ({
  messages: [] as Stored[],
  balance: 100,
  charged: [] as { key: string; microCredits: number }[],
  seq: 0,
}));

vi.mock('@easyrender/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@easyrender/core')>();
  return {
    ...actual,
    getBalance: async () => store.balance,
    getAgentChat: async () => ({
      id: 'c1',
      title: null,
      updatedAt: '',
      messages: store.messages.map((m) => ({ ...m, createdAt: '' })),
    }),
    appendAgentMessage: async (
      _user: string,
      _chat: string,
      message: { role: 'user' | 'assistant'; content: Record<string, unknown>[] },
    ) => {
      store.seq += 1;
      const id = `m${store.seq}`;
      store.messages.push({ id, role: message.role, content: message.content, credits: 0 });
      return { id };
    },
    chargeAgentTurn: async (input: { key: string; microCredits: number }) => {
      store.charged.push(input);
      return Math.floor(input.microCredits / 1_000_000);
    },
    setAgentMessageCredits: async (_u: string, id: string, credits: number) => {
      const message = store.messages.find((m) => m.id === id);
      if (message) message.credits = credits;
    },
    getRender: async () => ({ id: 'r1' }),
    toView: () => ({
      status: 'preview_ready',
      credits: 0,
      qualityCredits: { low: 35, medium: 70, high: 100 },
    }),
  };
});

import { agentMicroCredits } from '@easyrender/harness';
import {
  type AgentEvent,
  type ModelClient,
  openToolbox,
  pendingApprovals,
  quotedTools,
  resolveAgentApproval,
  sendAgentMessage,
  type Toolbox,
  toModelMessages,
  unresolvedToolUses,
} from './agent';

const actor = { userId: 'u1' };
const usage = (input: number, output: number) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
});
const reply = (content: unknown[], stop: Anthropic.StopReason, tokens = usage(1000, 100)) =>
  ({ content, stop_reason: stop, usage: tokens }) as unknown as Anthropic.Message;
const text = (value: string) => ({ type: 'text', text: value, citations: null });
const toolUse = (id: string, name: string, input: Record<string, unknown> = {}) => ({
  type: 'tool_use',
  id,
  name,
  input,
});

// A model that answers with the given messages in order, and records what it was sent.
function fakeModel(answers: (Anthropic.Message | Error)[]) {
  const sent: Anthropic.MessageStreamParams[] = [];
  const client: ModelClient = {
    messages: {
      stream(params) {
        sent.push(JSON.parse(JSON.stringify(params)));
        const next = answers.shift();
        const listeners: ((delta: string) => void)[] = [];
        const stream = {
          on(_event: 'text', listener: (delta: string) => void) {
            listeners.push(listener);
            return stream;
          },
          async finalMessage() {
            if (!next) throw new Error('the model was called more than expected');
            if (next instanceof Error) throw next;
            for (const block of next.content) {
              if (block.type === 'text') for (const l of listeners) l(block.text);
            }
            return next;
          },
        };
        return stream;
      },
    },
  };
  return { client, sent };
}

function fakeToolbox(calls: { name: string; input: Record<string, unknown> }[] = []): Toolbox {
  return {
    tools: [],
    gated: new Map([['render_3d', { title: 'Render in 3D', takesBudget: true }]]),
    async call(name, input) {
      calls.push({ name, input });
      return { text: JSON.stringify({ ok: name }), isError: false };
    },
    async close() {},
  };
}

const run = (turn: {
  text?: string;
  events?: AgentEvent[];
  client: ModelClient;
  toolbox?: Toolbox;
}) =>
  sendAgentMessage({
    actor,
    chatId: 'c1',
    text: turn.text ?? 'hello',
    emit: (event) => turn.events?.push(event),
    deps: { client: turn.client, toolbox: turn.toolbox ?? fakeToolbox() },
  });

beforeEach(() => {
  store.messages = [];
  store.balance = 100;
  store.charged = [];
  store.seq = 0;
});

describe('agent turn', () => {
  it('answers, stores both messages and charges the tokens used at the margin rule', async () => {
    const { client } = fakeModel([reply([text('Hi there')], 'end_turn')]);
    const events: AgentEvent[] = [];
    await run({ client, events });
    expect(store.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(events).toContainEqual({ type: 'text', delta: 'Hi there' });
    expect(store.charged).toHaveLength(1);
    expect(store.charged[0]?.microCredits).toBe(
      agentMicroCredits({
        inputTokens: 1000,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    );
    expect(events.at(-1)).toEqual({ type: 'done', credits: 0 });
  });

  it('runs a free tool, feeds the result back and charges both model rounds', async () => {
    const calls: { name: string; input: Record<string, unknown> }[] = [];
    const { client, sent } = fakeModel([
      reply([toolUse('t1', 'get_credits')], 'tool_use'),
      reply([text('You have credits.')], 'end_turn'),
    ]);
    await run({ client, toolbox: fakeToolbox(calls) });
    expect(calls).toEqual([{ name: 'get_credits', input: {} }]);
    // The second request carries the tool result for the tool call.
    const last = sent[1]?.messages.at(-1);
    expect(last?.role).toBe('user');
    expect(JSON.stringify(last?.content)).toContain('"tool_use_id":"t1"');
    expect(store.charged[0]?.microCredits).toBe(
      agentMicroCredits({
        inputTokens: 2000,
        outputTokens: 200,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    );
  });

  it('does not run a paid tool: it waits for approval with the price', async () => {
    const calls: { name: string; input: Record<string, unknown> }[] = [];
    const { client } = fakeModel([
      reply(
        [text('Building.'), toolUse('t1', 'render_3d', { id: 'r1', quality: 'low' })],
        'tool_use',
      ),
    ]);
    const events: AgentEvent[] = [];
    await run({ client, events, toolbox: fakeToolbox(calls) });
    expect(calls).toEqual([]);
    const approval = events.find((event) => event.type === 'approval');
    expect(approval).toMatchObject({
      approvals: [{ toolUseId: 't1', name: 'render_3d', title: 'Render in 3D', credits: 35 }],
    });
    expect(unresolvedToolUses(store.messages as never)).toHaveLength(1);
    expect(await pendingApprovals(actor, 'c1', { toolbox: fakeToolbox() })).toMatchObject([
      { toolUseId: 't1', credits: 35 },
    ]);
  });

  it('runs an approved call with the quoted price as its ceiling, then the model continues', async () => {
    const calls: { name: string; input: Record<string, unknown> }[] = [];
    const toolbox = fakeToolbox(calls);
    await run({
      client: fakeModel([reply([toolUse('t1', 'render_3d', { id: 'r1' })], 'tool_use')]).client,
      toolbox,
    });
    const { client, sent } = fakeModel([reply([text('Your model is building.')], 'end_turn')]);
    await resolveAgentApproval({
      actor,
      chatId: 'c1',
      toolUseId: 't1',
      decision: 'approve',
      emit: () => {},
      deps: { client, toolbox },
    });
    expect(calls).toEqual([{ name: 'render_3d', input: { id: 'r1', max_credits: 35 } }]);
    expect(unresolvedToolUses(store.messages as never)).toHaveLength(0);
    expect(sent).toHaveLength(1);
  });

  it('declining runs nothing and tells the model', async () => {
    const calls: { name: string; input: Record<string, unknown> }[] = [];
    const toolbox = fakeToolbox(calls);
    await run({
      client: fakeModel([reply([toolUse('t1', 'render_3d', { id: 'r1' })], 'tool_use')]).client,
      toolbox,
    });
    const { client, sent } = fakeModel([reply([text('Okay, not building.')], 'end_turn')]);
    await resolveAgentApproval({
      actor,
      chatId: 'c1',
      toolUseId: 't1',
      decision: 'decline',
      emit: () => {},
      deps: { client, toolbox },
    });
    expect(calls).toEqual([]);
    expect(JSON.stringify(sent[0]?.messages.at(-1))).toContain('"is_error":true');
  });

  it('declines an open approval when the person writes something else', async () => {
    const toolbox = fakeToolbox();
    await run({
      client: fakeModel([reply([toolUse('t1', 'render_3d', { id: 'r1' })], 'tool_use')]).client,
      toolbox,
    });
    const { client, sent } = fakeModel([reply([text('Sure.')], 'end_turn')]);
    await run({ client, toolbox, text: 'Actually, show me my credits' });
    const messages = sent[0]?.messages ?? [];
    // assistant tool call, then ONE user message: the declined result, then the person's words.
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    const content = messages.at(-1)?.content as { type: string }[];
    expect(content.map((block) => block.type)).toEqual(['tool_result', 'text']);
  });

  it('refuses a person with no credits before storing anything', async () => {
    store.balance = 0;
    const { client } = fakeModel([]);
    await expect(run({ client })).rejects.toMatchObject({ status: 402 });
    expect(store.messages).toEqual([]);
  });

  it('charges the tokens already used when a later round fails, and rethrows', async () => {
    const { client } = fakeModel([
      reply([toolUse('t1', 'get_credits')], 'tool_use'),
      new Error('provider down'),
    ]);
    await expect(run({ client })).rejects.toThrow('provider down');
    expect(store.charged).toHaveLength(1);
    expect(store.charged[0]?.microCredits).toBeGreaterThan(0);
  });

  it('charges nothing when the provider was never reached', async () => {
    const { client } = fakeModel([new Error('provider down')]);
    await expect(run({ client })).rejects.toThrow('provider down');
    expect(store.charged[0]?.microCredits).toBe(0);
  });

  it('stops before a round the balance cannot pay', async () => {
    store.balance = 1;
    // One round with a very large prompt already costs more than a credit.
    const { client, sent } = fakeModel([
      reply([toolUse('t1', 'get_credits')], 'tool_use', usage(2_000_000, 0)),
      reply([text('never reached')], 'end_turn'),
    ]);
    const events: AgentEvent[] = [];
    await run({ client, events });
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(events)).toContain('out of credits');
  });
});

describe('toModelMessages', () => {
  const user = (content: Record<string, unknown>[], id = 'x'): Stored => ({
    id,
    role: 'user',
    content,
    credits: 0,
  });
  const assistant = (content: Record<string, unknown>[], id = 'y'): Stored => ({
    id,
    role: 'assistant',
    content,
    credits: 0,
  });

  it('merges consecutive messages of one role', () => {
    const out = toModelMessages([
      user([{ type: 'text', text: 'a' }]),
      assistant([toolUse('t1', 'a'), toolUse('t2', 'b')]),
      user([{ type: 'tool_result', tool_use_id: 't1', content: '1' }]),
      user([{ type: 'tool_result', tool_use_id: 't2', content: '2' }]),
    ] as never);
    expect(out.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect((out[2]?.content as unknown[] | undefined)?.length).toBe(2);
  });

  it('starts a long chat at a message of the person, never inside a tool exchange', () => {
    const messages: Stored[] = [];
    for (let i = 0; i < 40; i += 1) {
      messages.push(user([{ type: 'text', text: `q${i}` }]));
      messages.push(assistant([text(`a${i}`)]));
    }
    // Make the 30-message window open on a tool result.
    messages.splice(
      messages.length - 30,
      0,
      user([{ type: 'tool_result', tool_use_id: 'old', content: 'x' }]),
    );
    const out = toModelMessages(messages as never);
    expect(out[0]?.role).toBe('user');
    expect(JSON.stringify(out[0])).not.toContain('tool_result');
  });
});

describe('the tools the agent is given', () => {
  it('prices every tool that changes something, so nothing paid runs without a quote', async () => {
    const toolbox = await openToolbox(actor);
    try {
      expect([...toolbox.gated.keys()].sort()).toEqual([...quotedTools()].sort());
      // Reads and the free preview are offered without an approval.
      const free = toolbox.tools
        .map((tool) => tool.name)
        .filter((name) => !toolbox.gated.has(name));
      expect(free).toEqual(expect.arrayContaining(['create_render', 'get_render', 'get_credits']));
    } finally {
      await toolbox.close();
    }
  });
});
