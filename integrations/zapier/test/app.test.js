const assert = require('node:assert/strict');
const { afterEach, beforeEach, test } = require('node:test');
const nock = require('nock').default;
const zapier = require('zapier-platform-core');
const App = require('../index');
const run = zapier.createAppTester(App);
const authData = { apiKey: 'er_test_only', accountLabel: 'Catalog team' };
const api = () =>
  nock('https://easyrender.ai', { reqheaders: { authorization: 'Bearer er_test_only' } });
beforeEach(() => nock.disableNetConnect());
afterEach(() => {
  assert.deepEqual(nock.pendingMocks(), []);
  nock.cleanAll();
  nock.enableNetConnect();
});

test('auth validates using credits and returns a non-secret connection label', async () => {
  api().get('/api/credits').reply(200, { balance: 0 });
  const result = await run(App.authentication.test, { authData });
  assert.equal(result.accountLabel, 'Catalog team');
  assert.equal(JSON.stringify(result).includes(authData.apiKey), false);
});
test('create submits private URL preview, metadata and idempotency key', async () => {
  api()
    .post('/api/renders', {
      image_url: 'https://example.com/chair.jpg',
      isPublic: false,
      name: 'Chair',
    })
    .matchHeader('Idempotency-Key', 'chair-v1')
    .reply(201, { id: 'r_1', status: 'drafting' });
  const result = await run(App.creates.create_render.operation.perform, {
    authData,
    inputData: {
      image_url: 'https://example.com/chair.jpg',
      name: 'Chair',
      idempotency_key: 'chair-v1',
    },
  });
  assert.equal(result.id, 'r_1');
  assert.equal(result.status, 'drafting');
});
test('get encodes IDs and returns current status', async () => {
  api().get('/api/renders/r%2Fa%3Fx').reply(200, { id: 'r/a?x', status: 'rendering' });
  assert.equal(
    (await run(App.creates.get_render.operation.perform, { authData, inputData: { id: 'r/a?x' } }))
      .status,
    'rendering',
  );
});
test('list forwards cursor and filter and returns the next cursor', async () => {
  api()
    .get('/api/renders')
    .query({ limit: 25, cursor: 'opaque', status: 'ready' })
    .reply(200, { renders: [{ id: 'r_1' }], nextCursor: 'next', balance: 0 });
  const page = await run(App.creates.list_renders.operation.perform, {
    authData,
    inputData: { limit: 25, cursor: 'opaque', status: 'ready' },
  });
  assert.equal(page.nextCursor, 'next');
  assert.equal(page.renders[0].id, 'r_1');
});
test('get credits returns the live account quote', async () => {
  api().get('/api/credits').reply(200, { balance: 0, currency: 'eur' });
  assert.equal(
    (await run(App.creates.get_credits.operation.perform, { authData, inputData: {} })).currency,
    'eur',
  );
});
for (const [status, hasModel, expected] of [
  ['drafting', false, 0],
  ['preview_ready', false, 0],
  ['rendering', false, 0],
  ['ready', false, 0],
  ['ready', true, 1],
]) {
  test(`model-ready polling: ${status}, hasModel=${hasModel}`, async () => {
    api().get('/api/renders/r_1').reply(200, { id: 'r_1', status, hasModel });
    const items = await run(App.triggers.model_ready.operation.perform, {
      authData,
      inputData: { id: 'r_1' },
    });
    assert.equal(items.length, expected);
    if (expected) assert.equal(items[0].id, 'r_1');
  });
}
for (const status of [401, 403, 404, 409, 429, 500]) {
  test(`surfaces HTTP ${status} without retrying or returning success`, async () => {
    api()
      .get('/api/credits')
      .reply(
        status,
        {
          error: 'Request rejected',
          code: 'test_error',
          request_id: 'req_test',
          retryable: status === 429,
        },
        { 'Retry-After': '17' },
      );
    await assert.rejects(
      () => run(App.creates.get_credits.operation.perform, { authData, inputData: {} }),
      (error) => {
        if (status === 401) assert.match(error.message, /reconnect/i);
        else if (status === 429) assert.match(error.message, /17|rate|retry/i);
        else assert.match(error.message, /req_test/);
        return true;
      },
    );
  });
}
test('failed renders surface a job failure instead of an endless silent poll', async () => {
  api()
    .get('/api/renders/r_1')
    .reply(200, { id: 'r_1', status: 'failed', hasModel: false, error: 'Generation failed' });
  await assert.rejects(
    () => run(App.triggers.model_ready.operation.perform, { authData, inputData: { id: 'r_1' } }),
    /failed/i,
  );
});

test('missing idempotency key fails before submitting a preview', async () => {
  await assert.rejects(
    () =>
      run(App.creates.create_render.operation.perform, {
        authData,
        inputData: { image_url: 'https://example.com/a.jpg' },
      }),
    /Idempotency key/,
  );
});
test('an uncertain creation failure is not resubmitted automatically', async () => {
  api()
    .post('/api/renders')
    .reply(500, { error: 'Unknown outcome', code: 'internal', request_id: 'req_create' });
  await assert.rejects(
    () =>
      run(App.creates.create_render.operation.perform, {
        authData,
        inputData: { image_url: 'https://example.com/a.jpg', idempotency_key: 'stable-event' },
      }),
    /req_create/,
  );
});
