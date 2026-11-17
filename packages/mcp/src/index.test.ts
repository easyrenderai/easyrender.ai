import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({
  createDraft: vi.fn(),
  createModelExport: vi.fn(),
  getRender: vi.fn(),
  startBuild: vi.fn(),
  fetchRemoteImage: vi.fn(),
  getUploadedImage: vi.fn(),
  listRenderPage: vi.fn(),
  listViewSets: vi.fn(),
  listUpscales: vi.fn(),
  polishView: vi.fn(),
  setVisibility: vi.fn(),
  startSheet: vi.fn(),
  redrawSheet: vi.fn(),
  startUpscale: vi.fn(),
  getUpscale: vi.fn(),
  createViewSet: vi.fn(),
  getViewSet: vi.fn(),
  createRenderFromViews: vi.fn(),
  getBalance: vi.fn(async () => 500),
  buyerCurrency: vi.fn(async () => 'eur'),
  getTopupPricing: vi.fn(async () => ({ currency: 'eur', plan: null, creditPrice: 0.01 })),
}));
vi.mock('@easyrender/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@easyrender/core')>();
  const { AppError } = actual;
  return {
    ...actual,
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
      sheet_credits: 4,
      product_views_credits: 100,
      view_polish_credits: 2,
      upscale_credits: 1,
      build_from_views_credits: 60,
      plans: {
        pay_as_you_go: { price_per_credit: 0.01, min_credits: 500, max_credits: 100000 },
        pro: { price_per_month: 46, credits_per_month: 5500 },
        enterprise: { book_a_call: 'https://example.com/book' },
      },
      topup: { plan: null, currency: 'eur', price_cents: 1, credits_per_unit: 1 },
      buy: 'https://easyrender.ai/credits',
    }),
    toView: (value: unknown) => value,
    toUpscaleView: (value: unknown) => value,
    toViewSetView: (value: unknown) => value,
    reportError: vi.fn(),
  };
});
const { createMcpServer } = await import('./index');
const connections: Array<{ client: Client; server: ReturnType<typeof createMcpServer> }> = [];
async function connect(scopes?: string[]) {
  const server = createMcpServer({
    ...(scopes ? { apiKeyId: 'key1', apiKeyScopes: scopes } : {}),
    userId: 'u1',
    geoCountry: 'ES',
  });
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
  it('also rejects anonymous execution at the tool boundary without the HTTP gate', async () => {
    const server = createMcpServer({});
    const client = new Client({ name: 'anonymous', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    connections.push({ client, server });
    const result = await client.callTool({ name: 'get_credits', arguments: {} });
    expect(result).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'unauthorized', status: 401 } },
    });
  });

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
  it('returns a signed export link for the owner only when export_format is set', async () => {
    core.getRender.mockResolvedValue({ ...render, status: 'ready', hasModel: true });
    core.createModelExport.mockResolvedValue({
      format: 'fbx',
      url: 'https://cdn.easyrender.ai/exports/r1/1/model-fbx.fbx?Expires=1',
      filename: 'easyrender-r1-fbx.fbx',
      expiresAt: '2026-11-16T23:00:00.000Z',
    });
    const client = await connect();
    const plain = await client.callTool({ name: 'get_render', arguments: { id: 'r1' } });
    expect(plain.structuredContent).not.toHaveProperty('export');
    expect(core.createModelExport).not.toHaveBeenCalled();
    const result = await client.callTool({
      name: 'get_render',
      arguments: { id: 'r1', export_format: 'fbx' },
    });
    expect(result.structuredContent).toMatchObject({
      id: 'r1',
      export: {
        format: 'fbx',
        filename: 'easyrender-r1-fbx.fbx',
        expires_at: '2026-11-16T23:00:00.000Z',
      },
    });
    expect(core.createModelExport).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ userId: 'u1' }),
      'fbx',
    );
  });
  it('does not export a render that is not the caller’s or an unknown format', async () => {
    const { AppError } = await import('@easyrender/core');
    core.getRender.mockResolvedValue({ ...render, status: 'ready' });
    core.createModelExport.mockRejectedValue(new AppError('Not found', 404, 'not_found'));
    const client = await connect();
    expect(
      await client.callTool({ name: 'get_render', arguments: { id: 'r1', export_format: 'obj' } }),
    ).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'not_found', status: 404 } },
    });
    await expect(
      client.callTool({ name: 'get_render', arguments: { id: 'r1', export_format: 'stl' } }),
    ).resolves.toMatchObject({ isError: true });
    const anonymous = createMcpServer({});
    const anon = new Client({ name: 'anon', version: '1' });
    const [c, s] = InMemoryTransport.createLinkedPair();
    await anonymous.connect(s);
    await anon.connect(c);
    connections.push({ client: anon, server: anonymous });
    expect(
      await anon.callTool({ name: 'get_render', arguments: { id: 'r1', export_format: 'obj' } }),
    ).toMatchObject({ isError: true, structuredContent: { error: { status: 401 } } });
    expect(core.createModelExport).toHaveBeenCalledTimes(1);
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
  it('accepts an owner-scoped upload reference without sending the photo through JSON', async () => {
    core.getUploadedImage.mockResolvedValue({
      bytes: new Uint8Array([1]),
      contentType: 'image/png',
    });
    core.createDraft.mockResolvedValue(render);
    const response = await (await connect()).callTool({
      name: 'create_render',
      arguments: { upload_id: 'upload1' },
    });
    expect(response.isError).not.toBe(true);
    expect(core.getUploadedImage).toHaveBeenCalledWith(
      'upload1',
      expect.objectContaining({ userId: 'u1' }),
    );
  });
  it('rejects an inline image above its documented decoded limit', async () => {
    const { MAX_INLINE_IMAGE_BYTES } = await import('./index');
    const response = await (await connect()).callTool({
      name: 'create_render',
      arguments: {
        image_base64: Buffer.alloc(MAX_INLINE_IMAGE_BYTES + 1).toString('base64'),
        content_type: 'image/jpeg',
      },
    });
    expect(response.isError).toBe(true);
    expect(core.createDraft).not.toHaveBeenCalled();
  });
  it('enforces the supplied render budget before starting a paid generation', async () => {
    core.getRender.mockResolvedValue(render);
    core.startBuild.mockResolvedValue({ ...render, status: 'rendering', credits: 64 });
    const client = await connect();
    const refused = await client.callTool({
      name: 'render_3d',
      arguments: { id: 'r1', max_credits: 63 },
    });
    expect(refused).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'budget_exceeded' } },
    });
    expect(core.startBuild).not.toHaveBeenCalled();
    const accepted = await client.callTool({
      name: 'render_3d',
      arguments: { id: 'r1', max_credits: 64 },
    });
    expect(accepted.isError).not.toBe(true);
  });
  it('lists owned renders with a usable continuation cursor', async () => {
    core.listRenderPage.mockResolvedValue({ renders: [render], nextCursor: 'next1' });
    const response = await (await connect()).callTool({
      name: 'list_renders',
      arguments: { limit: 10 },
    });
    expect(response.structuredContent).toMatchObject({
      renders: [{ id: 'r1' }],
      next_cursor: 'next1',
    });
  });
  it('lets an authorized caller explicitly control render visibility', async () => {
    core.setVisibility.mockResolvedValue({ ...render, isPublic: true });
    const response = await (await connect()).callTool({
      name: 'set_render_visibility',
      arguments: { id: 'r1', is_public: true },
    });
    expect(response.structuredContent).toMatchObject({ id: 'r1', isPublic: true });
  });
  it('rejects a product-view purchase below the quoted amount before reading an image', async () => {
    const response = await (await connect()).callTool({
      name: 'create_product_views',
      arguments: { upload_id: 'upload1', max_credits: 0 },
    });
    expect(response).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'budget_exceeded' } },
    });
    expect(core.createViewSet).not.toHaveBeenCalled();
    expect(core.getUploadedImage).not.toHaveBeenCalled();
  });
  it('rejects an unapproved redraw without starting another paid sheet', async () => {
    const response = await (await connect()).callTool({
      name: 'redraw_render_sheet',
      arguments: { id: 'r1', note: 'Correct the legs', max_credits: 0 },
    });
    expect(response).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'budget_exceeded' } },
    });
    expect(core.redrawSheet).not.toHaveBeenCalled();
  });
  it('reuses existing angle sheets without needing another budget and supports approved redraws', async () => {
    core.getRender.mockResolvedValue({ ...render, sheetKey: 'sheet.png' });
    core.startSheet.mockResolvedValue(render);
    core.redrawSheet.mockResolvedValue({ ...render, status: 'drafting' });
    const client = await connect();
    expect(
      await client.callTool({
        name: 'start_render_sheet',
        arguments: { id: 'r1', max_credits: 0 },
      }),
    ).toMatchObject({ structuredContent: { id: 'r1', status: 'preview_ready' } });
    expect(
      await client.callTool({
        name: 'redraw_render_sheet',
        arguments: { id: 'r1', note: 'Correct the legs', max_credits: 10000 },
      }),
    ).toMatchObject({ structuredContent: { id: 'r1', status: 'drafting' } });
  });
  it('requires share permission to create an explicitly public preview', async () => {
    const response = await (await connect(['write'])).callTool({
      name: 'create_render',
      arguments: { upload_id: 'upload1', is_public: true },
    });
    expect(response).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'insufficient_scope' } },
    });
    expect(core.getUploadedImage).not.toHaveBeenCalled();
  });
  it('offers owner-scoped recovery lists and budget-gated product polishing', async () => {
    core.listViewSets.mockResolvedValue([]);
    core.listUpscales.mockResolvedValue([]);
    const client = await connect();
    expect(
      await client.callTool({ name: 'list_product_views', arguments: { limit: 20 } }),
    ).toMatchObject({ structuredContent: { view_sets: [] } });
    expect(
      await client.callTool({ name: 'list_upscales', arguments: { render_id: 'r1' } }),
    ).toMatchObject({ structuredContent: { upscales: [] } });
    expect(
      await client.callTool({
        name: 'polish_product_view',
        arguments: { id: 'v1', view: 'front', note: 'Fix the handle', max_credits: 0 },
      }),
    ).toMatchObject({ isError: true, structuredContent: { error: { code: 'budget_exceeded' } } });
    expect(core.polishView).not.toHaveBeenCalled();
  });
  it('blocks paid and publishing tools when the API key only permits reads', async () => {
    const client = await connect(['read']);
    for (const request of [
      { name: 'render_3d', arguments: { id: 'r1', max_credits: 100 } },
      { name: 'set_render_visibility', arguments: { id: 'r1', is_public: true } },
      { name: 'create_render', arguments: { upload_id: 'upload1' } },
    ]) {
      expect(await client.callTool(request)).toMatchObject({
        isError: true,
        structuredContent: { error: { code: 'insufficient_scope', status: 403 } },
      });
    }
    expect(core.startBuild).not.toHaveBeenCalled();
    expect(core.setVisibility).not.toHaveBeenCalled();
    expect(core.createDraft).not.toHaveBeenCalled();
  });
  it('returns the full typed product-view and upscale workflows through the SDK', async () => {
    const set = {
      id: 'v1',
      name: null,
      prompt: null,
      status: 'drafting',
      error: null,
      views: [],
      readyCount: 0,
      viewCount: 9,
      credits: 100,
      polishCredits: 2,
      upscaleCredits: 1,
      buildCredits: 60,
      renderId: null,
      createdAt: new Date(0).toISOString(),
    };
    const upscale = {
      id: 'up1',
      kind: 'sheet',
      renderId: 'r1',
      viewSetId: null,
      view: null,
      status: 'processing',
      hasImage: false,
      width: null,
      height: null,
      credits: 1,
      createdAt: new Date(0).toISOString(),
    };
    core.getUploadedImage.mockResolvedValue({
      bytes: new Uint8Array([1]),
      contentType: 'image/png',
    });
    core.createViewSet.mockResolvedValue(set);
    core.getViewSet.mockResolvedValue(set);
    core.startUpscale.mockResolvedValue(upscale);
    core.getUpscale.mockResolvedValue(upscale);
    const client = await connect();
    for (const request of [
      { name: 'create_product_views', arguments: { upload_id: 'upload1', max_credits: 10000 } },
      { name: 'get_product_views', arguments: { id: 'v1' } },
    ])
      expect(await client.callTool(request)).toMatchObject({
        structuredContent: {
          id: 'v1',
          status: 'drafting',
          links: { zip: 'https://easyrender.ai/api/product-views/v1/zip' },
        },
      });
    for (const request of [
      { name: 'upscale_image', arguments: { kind: 'sheet', render_id: 'r1', max_credits: 10000 } },
      { name: 'get_upscale', arguments: { id: 'up1' } },
    ])
      expect(await client.callTool(request)).toMatchObject({
        structuredContent: {
          id: 'up1',
          links: { image: 'https://easyrender.ai/api/upscales/up1/image' },
        },
      });
  });
  it('accepts an inline image at the advertised decoded limit', async () => {
    const { MAX_INLINE_IMAGE_BYTES } = await import('./index');
    core.createDraft.mockResolvedValue(render);
    const response = await (await connect()).callTool({
      name: 'create_render',
      arguments: {
        image_base64: Buffer.alloc(MAX_INLINE_IMAGE_BYTES).toString('base64'),
        content_type: 'image/jpeg',
      },
    });
    expect(response.isError).not.toBe(true);
    expect(core.createDraft.mock.calls[0]?.[0].bytes.length).toBe(MAX_INLINE_IMAGE_BYTES);
  });
  it('uses the remaining approved amount when building from paid product views', async () => {
    core.getViewSet.mockResolvedValue({ renderId: 'r1' });
    core.getRender.mockResolvedValue({ ...render, credits: 4 });
    core.createRenderFromViews.mockResolvedValue('r1');
    core.startBuild.mockResolvedValue({ ...render, status: 'rendering', credits: 64 });
    const client = await connect(['read', 'write', 'spend']);
    expect(
      await client.callTool({
        name: 'build_from_product_views',
        arguments: { id: 'v1', max_credits: 59 },
      }),
    ).toMatchObject({ isError: true, structuredContent: { error: { code: 'budget_exceeded' } } });
    expect(core.createRenderFromViews).not.toHaveBeenCalled();
    expect(
      await client.callTool({
        name: 'build_from_product_views',
        arguments: { id: 'v1', max_credits: 60 },
      }),
    ).toMatchObject({ structuredContent: { id: 'r1', status: 'rendering' } });
    expect(core.createRenderFromViews).toHaveBeenCalledWith(
      'v1',
      expect.objectContaining({ source: 'mcp', apiKeyId: 'key1' }),
    );
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
    { upload_id: 'u1', image_base64: 'YQ==', content_type: 'image/jpeg' },
    { upload_id: 'u1', image_url: 'https://cdn.example.com/photo.jpg' },
  ])('rejects ambiguous or invalid image arguments without creating a render', async (args) => {
    const result = await (await connect()).callTool({ name: 'create_render', arguments: args });
    expect(result.isError).toBe(true);
    expect(core.createDraft).not.toHaveBeenCalled();
  });
});

it.each([false, true])(
  'only offers a public page link for public renders (%s)',
  async (isPublic) => {
    core.getRender.mockResolvedValue({ ...render, isPublic });
    const response = await (await connect()).callTool({
      name: 'get_render',
      arguments: { id: 'r1' },
    });
    expect(response.isError).not.toBe(true);
    const value = response.structuredContent as { links: { page?: string } };
    expect(value.links.page).toBe(isPublic ? 'https://easyrender.ai/r/r1' : undefined);
  },
);

it('marks only operations without job or export mutations read-only', async () => {
  const tools = (await (await connect()).listTools()).tools;
  for (const tool of tools) {
    expect(tool.annotations?.readOnlyHint).toBe(
      ['get_credits', 'list_renders'].includes(tool.name),
    );
  }
});
