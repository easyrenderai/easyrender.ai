import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

// A small in-memory account stands in for packages/core, so the scenarios below assert what the
// server returns and what ends up stored (render rows, balance, ledger), not which functions ran.
type Row = {
  id: string;
  status: 'drafting' | 'preview_ready' | 'rendering' | 'ready' | 'failed';
  credits: number;
  renderCredits: number;
  hasModel: boolean;
  [key: string]: unknown;
};
const baseRow = vi.hoisted(() => ({
  prompt: null,
  name: null,
  error: null,
  hasPreview: true,
  hasSheet: true,
  sheetNote: null,
  modelVersion: 1,
  qualityCredits: { low: 64, medium: 120, high: 180 },
  buildQuality: 'low',
  rebuildRefundCredits: 0,
  sheetCredits: 4,
  upscaleCredits: 1,
  canUpscale: false,
  isPublic: false,
  source: 'mcp',
  createdAt: new Date(0).toISOString(),
}));
const db = vi.hoisted(() => ({
  renders: new Map<string, Record<string, unknown>>(),
  byKey: new Map<string, string>(),
  ledger: [] as Array<{ renderId: string; amount: number }>,
  balance: 0,
}));
vi.mock('@easyrender/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@easyrender/core')>();
  return {
    ...actual,
    config: { appUrl: () => 'https://easyrender.ai' },
    toView: (value: unknown) => value,
    reportError: vi.fn(),
    fetchRemoteImage: async () => ({ bytes: new Uint8Array([1]), contentType: 'image/jpeg' }),
    getBalance: async () => db.balance,
    assignedPricing: async () => 'control',
    getRender: async (id: string) => {
      const row = db.renders.get(id);
      if (!row) throw new actual.AppError('Not found', 404, 'not_found');
      return row;
    },
    createDraft: async (input: { idempotencyKey?: string }) => {
      const known = input.idempotencyKey ? db.byKey.get(input.idempotencyKey) : undefined;
      if (known) return db.renders.get(known);
      const id = `r${db.renders.size + 1}`;
      const row = {
        ...baseRow,
        id,
        status: 'preview_ready',
        credits: 0,
        renderCredits: 64,
        hasModel: false,
      };
      db.renders.set(id, row);
      if (input.idempotencyKey) db.byKey.set(input.idempotencyKey, id);
      return row;
    },
    startBuild: async (id: string) => {
      const row = db.renders.get(id) as Row;
      if (row.status !== 'preview_ready') return row;
      const debit = Math.max(0, row.renderCredits - row.credits);
      db.balance -= debit;
      db.ledger.push({ renderId: id, amount: -debit });
      row.status = 'rendering';
      row.credits = row.renderCredits;
      return row;
    },
  };
});
const { createMcpServer } = await import('./index');

const connections: Array<{ client: Client; server: ReturnType<typeof createMcpServer> }> = [];
async function connect(scopes?: string[]) {
  const server = createMcpServer({
    userId: 'u1',
    ...(scopes ? { apiKeyId: 'key1', apiKeyScopes: scopes } : {}),
  });
  const client = new Client({ name: 'skill-contract', version: '1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  connections.push({ client, server });
  return client;
}
afterEach(async () => {
  for (const pair of connections.splice(0)) {
    await pair.client.close();
    await pair.server.close();
  }
  db.renders.clear();
  db.byKey.clear();
  db.ledger.length = 0;
  db.balance = 0;
});

const skillDir = resolve(__dirname, '../../../skills/easyrender-image-to-3d');
const skillMd = readFileSync(resolve(skillDir, 'SKILL.md'), 'utf8');
const mcpMd = readFileSync(resolve(skillDir, 'references/mcp.md'), 'utf8');
const workflowsMd = readFileSync(resolve(skillDir, 'references/workflows.md'), 'utf8');

type Schema = {
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: unknown[];
  anyOf?: Schema[];
};
function collect(schema: Schema | undefined, names: Set<string>, values: Set<string>) {
  if (!schema) return;
  for (const value of schema.enum ?? []) values.add(String(value));
  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    names.add(name);
    collect(child, names, values);
  }
  collect(schema.items, names, values);
  for (const branch of schema.anyOf ?? []) collect(branch, names, values);
}
async function surface() {
  const tools = (await (await connect()).listTools()).tools;
  const names = new Set<string>();
  const values = new Set<string>();
  const inputs = new Map<string, Set<string>>();
  for (const tool of tools) {
    const own = new Set<string>();
    collect(tool.inputSchema as Schema, own, values);
    inputs.set(tool.name, own);
    for (const name of own) names.add(name);
    const out = new Set<string>();
    collect(tool.outputSchema as Schema, out, values);
    for (const name of out) {
      names.add(name);
      own.add(name);
    }
  }
  return { tools: tools.map((t) => t.name), names, values, inputs };
}
function codeSpans(text: string): string[] {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1] as string);
}
// Identifiers a doc names inside backticks, e.g. `{id, export_format?}` gives id, export_format.
function identifiers(span: string): string[] {
  const unquoted = span.replace(/"[^"]*"/g, '');
  return unquoted.match(/[A-Za-z][A-Za-z0-9_]*/g) ?? [];
}
const snake = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/;
const camel = /^[a-z]+[A-Z][A-Za-z0-9]*$/;
// Words the docs put in code that are protocol, HTTP or literal values, not tool fields.
const NOT_FIELDS = new Set([
  'isError',
  'structuredContent',
  'idempotency_key',
  'er_example',
  'r_example',
  'upload_id',
  'content_type',
  'creditLimit',
  'retry_after_seconds',
]);

describe('skill and MCP reference match the server', () => {
  it('documents exactly the tools the server registers', async () => {
    const { tools } = await surface();
    const rows = mcpMd.split('\n').filter((line) => /^\| `[a-z_0-9]+`/.test(line));
    const documented = rows.map((row) => /^\| `([a-z_0-9]+)`/.exec(row)?.[1]);
    expect(documented.sort()).toEqual([...tools].sort());
  });

  it('names only inputs and outputs the documented tool has', async () => {
    const { inputs, values } = await surface();
    for (const row of mcpMd.split('\n').filter((line) => /^\| `[a-z_0-9]+`/.test(line))) {
      const cells = row.split('|').map((cell) => cell.trim());
      const tool = /`([a-z_0-9]+)`/.exec(cells[1] ?? '')?.[1] as string;
      const accepted = inputs.get(tool) as Set<string>;
      const missing: string[] = [];
      for (const span of codeSpans(cells[2] ?? '')) {
        for (const word of identifiers(span)) {
          if (!snake.test(word) && !camel.test(word) && !/^(id|note|view|kind)$/.test(word))
            continue;
          if (!accepted.has(word) && !values.has(word)) missing.push(word);
        }
      }
      expect({ tool, missing }).toEqual({ tool, missing: [] });
    }
  });

  it('only names tools and fields the server defines', async () => {
    const { tools, names, values } = await surface();
    const known = new Set([...tools, ...names, ...values, ...NOT_FIELDS]);
    for (const [file, text] of [
      ['SKILL.md', skillMd],
      ['references/mcp.md', mcpMd],
      ['references/workflows.md', workflowsMd],
    ] as const) {
      const unknown = new Set<string>();
      for (const span of codeSpans(text)) {
        for (const word of identifiers(span)) {
          if ((snake.test(word) || camel.test(word)) && !known.has(word)) unknown.add(word);
        }
      }
      expect({ file, unknown: [...unknown] }).toEqual({ file, unknown: [] });
    }
  });

  it('exposes every status and link the skill tells the agent to branch on', async () => {
    const client = await connect();
    const out = (await client.listTools()).tools.find((t) => t.name === 'get_render')
      ?.outputSchema as Schema;
    const statuses = out.properties?.status?.enum;
    for (const status of ['drafting', 'preview_ready', 'rendering', 'ready', 'failed']) {
      expect(statuses).toContain(status);
      expect(skillMd).toContain(status);
    }
    expect(Object.keys(out.properties?.links?.properties ?? {})).toEqual(
      expect.arrayContaining(['page', 'preview', 'model_glb']),
    );
  });
});

describe('scripted agent scenarios', () => {
  function seed(row: Partial<Row> & { id: string }, balance = 500) {
    db.renders.set(row.id, {
      ...baseRow,
      status: 'preview_ready',
      credits: 0,
      renderCredits: 64,
      hasModel: false,
      ...row,
    });
    db.balance = balance;
  }

  it('does not build without the spend permission, and stores nothing', async () => {
    seed({ id: 'r1' });
    const refused = await (await connect(['read', 'write'])).callTool({
      name: 'render_3d',
      arguments: { id: 'r1', max_credits: 64 },
    });
    expect(refused).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'insufficient_scope', status: 403 } },
    });
    expect(db.renders.get('r1')).toMatchObject({ status: 'preview_ready', credits: 0 });
    expect(db.balance).toBe(500);
    expect(db.ledger).toEqual([]);
  });

  it('stops a build over the approved budget, then charges once within it', async () => {
    seed({ id: 'r1' });
    const client = await connect();
    const over = await client.callTool({
      name: 'render_3d',
      arguments: { id: 'r1', max_credits: 40 },
    });
    expect(over).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'budget_exceeded', retryable: false } },
    });
    expect(db.balance).toBe(500);
    expect(db.ledger).toEqual([]);

    const built = await client.callTool({
      name: 'render_3d',
      arguments: { id: 'r1', max_credits: 64 },
    });
    expect(built.structuredContent).toMatchObject({ id: 'r1', status: 'rendering' });
    expect(db.balance).toBe(436);
    expect(db.ledger).toEqual([{ renderId: 'r1', amount: -64 }]);
  });

  it('quotes only the remaining debit when the sheet is already paid', async () => {
    seed({ id: 'r1', credits: 4 });
    const client = await connect();
    const view = await client.callTool({ name: 'get_render', arguments: { id: 'r1' } });
    expect(view.structuredContent).toMatchObject({ pending_credits: 60 });
    expect(
      await client.callTool({ name: 'render_3d', arguments: { id: 'r1', max_credits: 59 } }),
    ).toMatchObject({ isError: true, structuredContent: { error: { code: 'budget_exceeded' } } });
    await client.callTool({ name: 'render_3d', arguments: { id: 'r1', max_credits: 60 } });
    expect(db.ledger).toEqual([{ renderId: 'r1', amount: -60 }]);
  });

  it('resumes a running render by id without a second charge', async () => {
    seed({ id: 'r1', status: 'rendering', credits: 64 }, 436);
    const client = await connect();
    const view = await client.callTool({ name: 'get_render', arguments: { id: 'r1' } });
    expect(view.structuredContent).toMatchObject({ status: 'rendering', pending_credits: 0 });
    // The retry the skill allows after a timeout: same id, zero extra authorization.
    const retry = await client.callTool({
      name: 'render_3d',
      arguments: { id: 'r1', max_credits: 0 },
    });
    expect(retry.isError).not.toBe(true);
    expect(db.balance).toBe(436);
    expect(db.ledger).toEqual([]);
  });

  it('returns the existing model for a ready render and an error for an unknown id', async () => {
    seed({ id: 'r1', status: 'ready', credits: 64, hasModel: true }, 436);
    const client = await connect();
    expect(
      (await client.callTool({ name: 'get_render', arguments: { id: 'r1' } })).structuredContent,
    ).toMatchObject({
      status: 'ready',
      hasModel: true,
      links: { model_glb: 'https://easyrender.ai/api/renders/r1/model' },
    });
    expect(await client.callTool({ name: 'get_render', arguments: { id: 'nope' } })).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'not_found' } },
    });
    expect(db.renders.size).toBe(1);
  });

  it('answers a retried create_render with the same key by the same render', async () => {
    db.balance = 500;
    const client = await connect();
    const args = { image_url: 'https://cdn.example.com/chair.jpg', idempotency_key: 'chair-1' };
    const first = await client.callTool({ name: 'create_render', arguments: args });
    const second = await client.callTool({ name: 'create_render', arguments: args });
    expect(first.isError).not.toBe(true);
    expect(second.structuredContent).toMatchObject({ id: (first.structuredContent as Row).id });
    expect(db.renders.size).toBe(1);
  });
});
