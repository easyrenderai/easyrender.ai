const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Easyrender } = require('../dist/nodes/Easyrender/Easyrender.node');
const { EasyrenderTrigger } = require('../dist/nodes/Easyrender/EasyrenderTrigger.node');
const { EasyrenderApi } = require('../dist/credentials/EasyrenderApi.credentials');

function context(parameters, replies = [], state = {}) {
  const requests = [];
  return {
    requests,
    getNodeParameter: (name, _index, fallback) => parameters[name] ?? fallback,
    getInputData: () => [{ json: {} }],
    getWorkflowStaticData: () => state,
    getMode: () => 'trigger',
    getNode: () => ({ name: 'easyrender', type: 'easyrender' }),
    continueOnFail: () => false,
    helpers: {
      httpRequestWithAuthentication: async (credential, options) => {
        assert.equal(credential, 'easyrenderApi');
        assert.ok(options.url.startsWith('https://easyrender.ai/api/'));
        requests.push(options);
        const reply = replies.shift();
        if (reply instanceof Error) throw reply;
        return reply;
      },
    },
  };
}

test('credential keeps the key in a secret field and tests a read-only endpoint', () => {
  const credential = new EasyrenderApi();
  assert.equal(credential.properties[0].typeOptions.password, true);
  assert.equal(credential.test.request.url, '/credits');
  assert.equal(
    credential.authenticate.properties.headers.Authorization,
    '=Bearer {{$credentials.apiKey}}',
  );
});
test('create sends one private preview with a stable idempotency key and no paid call', async () => {
  const ctx = context(
    {
      operation: 'create',
      imageUrl: 'https://example.com/chair.jpg',
      idempotencyKey: 'catalog-chair-v1',
      additionalFields: { name: 'Chair' },
    },
    [{ id: 'r_1', status: 'drafting' }],
  );
  const result = await Easyrender.prototype.execute.call(ctx);
  assert.equal(result[0][0].json.id, 'r_1');
  assert.equal(ctx.requests.length, 1);
  assert.equal(ctx.requests[0].headers['Idempotency-Key'], 'catalog-chair-v1');
  assert.deepEqual(ctx.requests[0].body, {
    image_url: 'https://example.com/chair.jpg',
    isPublic: false,
    name: 'Chair',
  });
  assert.deepEqual(result[0][0].pairedItem, { item: 0 });
});
test('get encodes render IDs as a single path segment', async () => {
  const ctx = context({ operation: 'get', renderId: 'r/a?x' }, [{ id: 'r/a?x' }]);
  await Easyrender.prototype.execute.call(ctx);
  assert.equal(ctx.requests[0].url, 'https://easyrender.ai/api/renders/r%2Fa%3Fx');
});
test('list preserves the cursor and envelope so workflows can continue pagination', async () => {
  const page = { renders: [{ id: 'r_1' }], nextCursor: 'opaque', balance: 0 };
  const ctx = context(
    { operation: 'list', limit: 25, filters: { cursor: 'previous', status: 'ready' } },
    [page],
  );
  assert.deepEqual((await Easyrender.prototype.execute.call(ctx))[0][0].json, page);
  assert.deepEqual(ctx.requests[0].qs, { limit: 25, cursor: 'previous', status: 'ready' });
});
test('credits reads the live quote', async () => {
  const ctx = context({ operation: 'credits' }, [{ balance: 0, currency: 'eur' }]);
  assert.equal((await Easyrender.prototype.execute.call(ctx))[0][0].json.currency, 'eur');
  assert.equal(ctx.requests[0].url, 'https://easyrender.ai/api/credits');
});
test('trigger ignores previews, emits ready once, and manual tests do not consume the event', async () => {
  const state = {};
  const ready = { id: 'r_1', status: 'ready', hasModel: true };
  const ctx = context(
    { renderId: 'r_1' },
    [
      { id: 'r_1', status: 'preview_ready', hasModel: false },
      { ...ready, hasModel: false },
      ready,
      ready,
      ready,
    ],
    state,
  );
  assert.equal(await EasyrenderTrigger.prototype.poll.call(ctx), null);
  assert.equal(await EasyrenderTrigger.prototype.poll.call(ctx), null);
  ctx.getMode = () => 'manual';
  assert.equal((await EasyrenderTrigger.prototype.poll.call(ctx))[0][0].json.id, 'r_1');
  assert.deepEqual(state, {});
  ctx.getMode = () => 'trigger';
  assert.equal((await EasyrenderTrigger.prototype.poll.call(ctx))[0][0].json.id, 'r_1');
  assert.equal(await EasyrenderTrigger.prototype.poll.call(ctx), null);
});
test('HTTP errors do not mark the trigger as delivered', async () => {
  const state = {};
  const ctx = context({ renderId: 'r_1' }, [new Error('401 Unauthorized')], state);
  await assert.rejects(() => EasyrenderTrigger.prototype.poll.call(ctx), /401/);
  assert.deepEqual(state, {});
});

test('continue-on-fail returns paired error output without resubmitting', async () => {
  const ctx = context({ operation: 'get', renderId: 'r_1' }, [new Error('Request rejected')]);
  ctx.continueOnFail = () => true;
  const result = await Easyrender.prototype.execute.call(ctx);
  assert.deepEqual(result, [[{ json: { error: 'Request rejected' }, pairedItem: { item: 0 } }]]);
  assert.equal(ctx.requests.length, 1);
});
test('creation requires a real idempotency key before sending a request', async () => {
  const ctx = context({
    operation: 'create',
    imageUrl: 'https://example.com/a.jpg',
    additionalFields: {},
  });
  await assert.rejects(() => Easyrender.prototype.execute.call(ctx), /Idempotency key/);
  assert.equal(ctx.requests.length, 0);
});
test('failed render raises an error and does not update the ready checkpoint', async () => {
  const state = {};
  const ctx = context(
    { renderId: 'r_1' },
    [{ id: 'r_1', status: 'failed', hasModel: false }],
    state,
  );
  await assert.rejects(() => EasyrenderTrigger.prototype.poll.call(ctx), /failed/);
  assert.deepEqual(state, {});
});
