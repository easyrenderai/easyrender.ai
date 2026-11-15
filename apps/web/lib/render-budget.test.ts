import { execFileSync } from 'node:child_process';
import { expect, it, vi } from 'vitest';
import { API_EXAMPLES } from '../components/api-landing/examples';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  startBuild: vi.fn(async (_id: string, actor: Record<string, unknown>) => actor),
}));
vi.mock('@easyrender/core', async (original) => ({
  ...(await original<typeof import('@easyrender/core')>()),
  startBuild: mocks.startBuild,
  toView: (value: unknown) => value,
}));
vi.mock('./actor', () => ({ resolveActor: async () => ({ userId: 'owner', apiKeyId: 'key' }) }));
const { POST } = await import('../app/api/renders/[id]/render/route');
it('passes an explicit REST ceiling to the transactional core without dropping key identity', async () => {
  const response = await POST(
    new Request('https://easyrender.ai/api/renders/r1/render', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ maxCredits: 0 }),
    }),
    { params: Promise.resolve({ id: 'r1' }) },
  );
  expect(await response.json()).toMatchObject({ userId: 'owner', apiKeyId: 'key', maxCredits: 0 });
});
it.each([-1, 1.5, '2', null, true, Number.MAX_SAFE_INTEGER + 1])(
  'refuses invalid ceilings %s before spending',
  async (maxCredits) => {
    mocks.startBuild.mockClear();
    const response = await POST(
      new Request('https://easyrender.ai/api/renders/r1/render', {
        method: 'POST',
        body: JSON.stringify({ maxCredits }),
      }),
      { params: Promise.resolve({ id: 'r1' }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.startBuild).not.toHaveBeenCalled();
  },
);
it('preserves existing clients with no request body', async () => {
  const response = await POST(
    new Request('https://easyrender.ai/api/renders/r1/render', { method: 'POST' }),
    { params: Promise.resolve({ id: 'r1' }) },
  );
  expect(response.status).toBe(200);
});

it('keeps the public curl ceiling as valid JSON after shell interpolation', () => {
  const snippet = API_EXAMPLES.find((example) => example.key === 'build')?.code.replace(
    'REPLACE_WITH_APPROVED_CREDIT_CEILING',
    '7',
  );
  expect(snippet).toBeDefined();
  const output = execFileSync('/bin/sh', ['-c', `curl() { printf '%s\\n' "$@"; }\n${snippet}`], {
    encoding: 'utf8',
    env: {
      NODE_ENV: 'test',
      EASYRENDER_URL: 'https://easyrender.ai',
      EASYRENDER_RENDER_ID: 'r1',
      EASYRENDER_API_KEY: 'test',
    },
  });
  const args = output.trim().split('\n');
  expect(JSON.parse(args[args.indexOf('--data') + 1] ?? '')).toEqual({ maxCredits: 7 });
});

it('bounds actual streamed request bytes without trusting Content-Length', async () => {
  mocks.startBuild.mockClear();
  const init = {
    method: 'POST',
    duplex: 'half',
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"padding":"'));
        controller.enqueue(new Uint8Array(4096).fill(97));
        controller.close();
      },
    }),
  };
  const request = new Request('https://easyrender.ai/api/renders/r1/render', init);
  expect(request.headers.has('content-length')).toBe(false);
  const response = await POST(request, { params: Promise.resolve({ id: 'r1' }) });
  expect(response.status).toBe(413);
  expect(mocks.startBuild).not.toHaveBeenCalled();
});
