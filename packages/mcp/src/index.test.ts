import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({
  createDraft: vi.fn(),
  getRender: vi.fn(),
  startBuild: vi.fn(),
  fetchRemoteImage: vi.fn(),
  getBalance: vi.fn(async () => 500),
  buyerCurrency: vi.fn(async () => 'eur'),
  getTopupPricing: vi.fn(async () => ({ currency: 'eur', plan: null, creditPrice: 0.01 })),
}));
vi.mock('@easyrender/core', async (importOriginal) => {
  const { AppError } = await importOriginal<typeof import('@easyrender/core')>();
  return {
    ...core,
    AppError,
    assignedPricing: async () => 'control',
    config: { appUrl: () => 'https://easyrender.ai' },
    MAX_UPLOAD_BYTES: 4 * 1024 * 1024,
    getCreditQuote: async () => ({
      pricing_variant: 'control',
      currency: 'eur',
      balance: 500,
      render_credits: 64,
      plans: {
        pay_as_you_go: { price_per_credit: 0.01, min_credits: 500, max_credits: 100000 },
        pro: { price_per_month: 46, credits_per_month: 5500 },
        enterprise: { book_a_call: 'https://example.com/book' },
      },
      topup: { plan: null, currency: 'eur', price_cents: 1, credits_per_unit: 1 },
      buy: 'https://easyrender.ai/credits',
    }),
    toView: (value: unknown) => value,
    reportError: vi.fn(),
  };
});
const { createMcpServer } = await import('./index');
const connections: Array<{ client: Client; server: ReturnType<typeof createMcpServer> }> = [];
async function connect() {
  const server = createMcpServer({ userId: 'u1', geoCountry: 'ES' });
  const client = new Client({ name: 'contract-test', version: '1' });
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
  vi.clearAllMocks();
});
const render = {
  id: 'r1',
  status: 'preview_ready',
  prompt: null,
  name: null,
  error: null,
  hasPreview: true,
  hasSheet: true,
  sheetNote: null,
  hasModel: false,
  modelVersion: 1,
  credits: 0,
  renderCredits: 64,
  sheetCredits: 4,
  upscaleCredits: 1,
  canUpscale: false,
  isPublic: false,
  source: 'mcp',
  createdAt: new Date(0).toISOString(),
};

describe('MCP protocol contract', () => {
  it('advertises schemas and truthful behavior annotations', async () => {
    const tools = (await (await connect()).listTools()).tools;
    for (const tool of tools) {
      expect(tool.outputSchema).toBeDefined();
      expect(tool.annotations).toBeDefined();
    }
    expect(tools.find((t) => t.name === 'render_3d')?.annotations?.idempotentHint).toBe(true);
  });
  it('returns machine-readable render state, remaining cost and matching text', async () => {
    core.getRender.mockResolvedValue(render);
    const result = await (await connect()).callTool({
      name: 'get_render',
      arguments: { id: 'r1' },
    });
    expect(result.structuredContent).toMatchObject({
      id: 'r1',
      pending_credits: 64,
      links: { model_glb: 'https://easyrender.ai/api/renders/r1/model' },
    });
    expect(result.content).toContainEqual({
      type: 'text',
      text: JSON.stringify(result.structuredContent),
    });
  });
  it('keeps application errors structured and identifies retryability', async () => {
    const { AppError } = await import('@easyrender/core');
    core.getRender.mockRejectedValue(
      new AppError('Not enough credits', 402, 'insufficient_credits'),
    );
    const result = await (await connect()).callTool({
      name: 'get_render',
      arguments: { id: 'r1' },
    });
    expect(result).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'insufficient_credits', status: 402, retryable: false } },
    });
  });
  it('quotes the actual buyer currency instead of labeling every price USD', async () => {
    const result = await (await connect()).callTool({ name: 'get_credits', arguments: {} });
    expect(result.structuredContent).toMatchObject({
      currency: 'eur',
      plans: { pay_as_you_go: { price_per_credit: 0.01 }, pro: { price_per_month: 46 } },
    });
    expect(result.structuredContent).not.toHaveProperty('plans.pay_as_you_go.usd_per_credit');
  });
  it('uses the protected downloader for URL photos', async () => {
    core.fetchRemoteImage.mockResolvedValue({
      bytes: new Uint8Array([1]),
      contentType: 'image/jpeg',
    });
    core.createDraft.mockResolvedValue(render);
    const result = await (await connect()).callTool({
      name: 'create_render',
      arguments: { image_url: 'https://cdn.example.com/photo.jpg' },
    });
    expect(result.isError).not.toBe(true);
    expect(core.fetchRemoteImage).toHaveBeenCalledWith('https://cdn.example.com/photo.jpg');
  });
  it.each([
    {
      image_url: 'https://cdn.example.com/photo.jpg',
      image_base64: 'YQ==',
      content_type: 'image/jpeg',
    },
    { image_base64: 'not base64!!', content_type: 'image/jpeg' },
    { image_base64: 'YQ==' },
    {},
  ])('rejects ambiguous or invalid image arguments without creating a render', async (args) => {
    const result = await (await connect()).callTool({ name: 'create_render', arguments: args });
    expect(result.isError).toBe(true);
    expect(core.createDraft).not.toHaveBeenCalled();
  });
});
