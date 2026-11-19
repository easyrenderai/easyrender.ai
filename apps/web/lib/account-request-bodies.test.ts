import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  createCheckoutDetails: vi.fn(async () => ({
    url: 'https://checkout.example.invalid/session',
    sessionId: null,
    analytics: null,
  })),
  createApiKey: vi.fn(async () => ({ id: 'fixture-key' })),
}));

vi.mock('@easyrender/core', async (original) => ({
  ...(await original<typeof import('@easyrender/core')>()),
  ...mocks,
  reportError: vi.fn(),
}));
vi.mock('./actor', () => ({
  resolveActor: async () => ({ userId: 'owner' }),
  currentUser: async () => ({ id: 'owner' }),
}));

const { POST: checkout } = await import('../app/api/checkout/route');
const { POST: createKey } = await import('../app/api/keys/route');

function post(path: string, body: string) {
  return new Request(`https://easyrender.ai/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

it.each(['null', '[]', '42', '"text"', '{'])(
  'rejects a non-object checkout body %s before creating a session',
  async (body) => {
    mocks.createCheckoutDetails.mockClear();
    const response = await checkout(post('checkout', body));
    expect(response.status).toBe(400);
    expect(mocks.createCheckoutDetails).not.toHaveBeenCalled();
  },
);

it.each(['null', '[]', '42', '"text"', '{'])(
  'rejects a non-object key body %s before creating a key',
  async (body) => {
    mocks.createApiKey.mockClear();
    const response = await createKey(post('keys', body));
    expect(response.status).toBe(400);
    expect(mocks.createApiKey).not.toHaveBeenCalled();
  },
);

it('still accepts a valid checkout request and an empty options object for a default key', async () => {
  const checkoutResponse = await checkout(post('checkout', '{"plan":"payg","credits":25}'));
  expect(checkoutResponse.status).toBe(200);
  expect(await checkoutResponse.json()).toMatchObject({
    url: 'https://checkout.example.invalid/session',
  });

  const keyResponse = await createKey(post('keys', '{}'));
  expect(keyResponse.status).toBe(201);
  expect(await keyResponse.json()).toEqual({ id: 'fixture-key' });
});
