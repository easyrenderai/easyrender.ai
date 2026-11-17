const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Easyrender } = require('../dist/nodes/Easyrender/Easyrender.node');
const { EasyrenderTrigger } = require('../dist/nodes/Easyrender/EasyrenderTrigger.node');
const { EasyrenderApi } = require('../dist/credentials/EasyrenderApi.credentials');

function context(parameters, replies = [], state = {}) {
  const requests = [];
  return {
    requests,
    getNodeParameter: (name, indexOrFallback, fallback) =>
      parameters[name] ??
      fallback ??
      (typeof indexOrFallback === 'boolean' ? indexOrFallback : undefined),
    getInputData: () => [{ json: {} }],
    getWorkflowStaticData: () => state,
    getMode: () => 'trigger',
    getNode: () => ({ name: 'easyrender', type: 'easyrender' }),
    continueOnFail: () => false,
    helpers: {
      prepareBinaryData: async (bytes, fileName, mimeType) => ({
        data: bytes.toString('base64'),
        fileName,
        mimeType,
      }),
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

const readyRender = {
  id: 'r_1',
  status: 'ready',
  hasPreview: true,
  hasSheet: true,
  hasModel: true,
  isPublic: false,
  modelVersion: 123,
  name: 'Chair',
  request_id: 'request-example',
};
const imageBytes = Buffer.from('test image bytes');
function imageResponse(mimeType = 'image/webp', statusCode = 200) {
  return { body: imageBytes, headers: { 'content-type': mimeType }, statusCode };
}

for (const mode of ['get', 'trigger']) {
  const run = (ctx) =>
    mode === 'get'
      ? Easyrender.prototype.execute.call(ctx)
      : EasyrenderTrigger.prototype.poll.call(ctx);

  test(`${mode} defaults to visible authenticated preview and sheet binaries with model links`, async () => {
    const ctx = context({ operation: 'get', renderId: 'r_1' }, [readyRender, imageResponse()]);
    const [[item]] = await run(ctx);
    for (const key of ['preview', 'sheet']) {
      assert.ok(item.binary?.[key], `${key} binary is present`);
      assert.equal(item.binary[key].mimeType, 'image/webp');
      assert.equal(item.binary[key].fileName, `easyrender-r_1-${key}.webp`);
      assert.deepEqual(Buffer.from(item.binary[key].data, 'base64'), imageBytes);
    }
    for (const [key, value] of Object.entries(readyRender)) assert.deepEqual(item.json[key], value);
    assert.equal(item.json.viewerUrl, 'https://easyrender.ai/r/r_1');
    assert.equal(item.json.glbUrl, 'https://easyrender.ai/api/renders/r_1/model?download=1');
    assert.equal(item.json.usdzUrl, null);
    assert.equal(item.json.summary, 'Ready - 3D model available');
    assert.equal(ctx.requests.length, 2, 'preview and sheet share the same API asset');
    assert.equal(ctx.requests[1].url, 'https://easyrender.ai/api/renders/r_1/preview');
    assert.equal(ctx.requests[1].encoding, 'arraybuffer');
    assert.equal(
      ctx.requests[1].disableFollowRedirect,
      true,
      'never forward the API key to another host',
    );
    if (mode === 'get') assert.deepEqual(item.pairedItem, { item: 0 });
  });

  test(`${mode} can disable images without removing links or old fields`, async () => {
    const ctx = context({ operation: 'get', renderId: 'r_1', downloadImages: false }, [
      readyRender,
    ]);
    const [[item]] = await run(ctx);
    assert.equal(item.binary, undefined);
    assert.equal(item.json.viewerUrl, 'https://easyrender.ai/r/r_1');
    assert.equal(item.json.hasModel, true);
    assert.equal(ctx.requests.length, 1);
  });

  for (const statusCode of [404, 410]) {
    test(`${mode} keeps JSON when an image is missing (${statusCode})`, async () => {
      const ctx = context({ operation: 'get', renderId: 'r_1' }, [
        readyRender,
        imageResponse('text/html', statusCode),
      ]);
      const [[item]] = await run(ctx);
      assert.equal(item.binary, undefined);
      assert.equal(item.json.summary, 'Ready - 3D model available');
    });
  }

  for (const statusCode of [401, 403, 302, 500]) {
    test(`${mode} surfaces image HTTP ${statusCode} without consuming a trigger event`, async () => {
      const state = {};
      const ctx = context(
        { operation: 'get', renderId: 'r_1' },
        [readyRender, imageResponse('text/html', statusCode)],
        state,
      );
      await assert.rejects(() => run(ctx), new RegExp(String(statusCode)));
      assert.deepEqual(state, {});
    });
  }
}

for (const [mimeType, extension] of [
  ['image/png', 'png'],
  ['image/jpeg; charset=binary', 'jpg'],
]) {
  test(`preview without a sheet uses ${extension} metadata and omits model links`, async () => {
    const ctx = context({ operation: 'get', renderId: 'r_1' }, [
      { ...readyRender, status: 'preview_ready', hasSheet: false, hasModel: false },
      imageResponse(mimeType),
    ]);
    const [[item]] = await Easyrender.prototype.execute.call(ctx);
    assert.ok(item.binary?.preview);
    assert.equal(item.binary.preview.mimeType, mimeType.split(';')[0]);
    assert.equal(item.binary.preview.fileName, `easyrender-r_1-preview.${extension}`);
    assert.equal(item.binary.sheet, undefined);
    assert.equal(item.json.glbUrl, null);
    assert.equal(item.json.usdzUrl, null);
    assert.match(item.json.summary, /Preview ready/);
  });
}

test('drafting and failed renders have useful summaries without requesting missing images', async () => {
  for (const status of ['drafting', 'failed', 'rendering']) {
    const ctx = context({ operation: 'get', renderId: 'r/a?x' }, [
      { id: 'r/a?x', status, hasPreview: false, hasSheet: false, hasModel: false },
    ]);
    const [[item]] = await Easyrender.prototype.execute.call(ctx);
    assert.equal(item.json.viewerUrl, 'https://easyrender.ai/r/r%2Fa%3Fx');
    assert.equal(item.json.glbUrl, null);
    assert.equal(typeof item.json.summary, 'string');
    assert.equal(item.binary, undefined);
    assert.equal(ctx.requests.length, 1);
  }
});

test('HTML responses are never labeled as images', async () => {
  const ctx = context({ operation: 'get', renderId: 'r_1' }, [
    readyRender,
    imageResponse('text/html'),
  ]);
  await assert.rejects(() => Easyrender.prototype.execute.call(ctx), /image/i);
});

test('both nodes expose Download Images enabled by default', () => {
  for (const node of [new Easyrender(), new EasyrenderTrigger()]) {
    const field = node.description.properties.find(({ name }) => name === 'downloadImages');
    assert.ok(field);
    assert.equal(field.displayName, 'Download Images');
    assert.equal(field.type, 'boolean');
    assert.equal(field.default, true);
  }
});

test('Get Render keeps images linked to the right input in a batch', async () => {
  const ctx = context({}, [
    { ...readyRender, id: 'first' },
    imageResponse('image/png'),
    { ...readyRender, id: 'second', hasSheet: false },
    imageResponse('image/jpeg'),
  ]);
  ctx.getInputData = () => [{ json: { id: 'first' } }, { json: { id: 'second' } }];
  ctx.getNodeParameter = (name, index, fallback) =>
    ({ operation: 'get', renderId: index === 0 ? 'first' : 'second' })[name] ?? fallback;
  const [items] = await Easyrender.prototype.execute.call(ctx);
  assert.equal(items.length, 2);
  for (const [index, id] of ['first', 'second'].entries()) {
    assert.deepEqual(items[index].pairedItem, { item: index });
    assert.equal(items[index].json.id, id);
    assert.ok(items[index].binary.preview.fileName.includes(id));
  }
  assert.ok(items[0].binary.sheet);
  assert.equal(items[1].binary.sheet, undefined);
});

test('trigger retries a failed image download and emits once after success', async () => {
  const state = {};
  const ctx = context(
    { renderId: 'r_1' },
    [readyRender, new Error('Download timed out'), readyRender, imageResponse(), readyRender],
    state,
  );
  await assert.rejects(() => EasyrenderTrigger.prototype.poll.call(ctx), /timed out/);
  assert.deepEqual(state, {});
  const [[item]] = await EasyrenderTrigger.prototype.poll.call(ctx);
  assert.ok(item.binary.preview);
  assert.equal(state.lastReadyId, 'r_1');
  assert.equal(await EasyrenderTrigger.prototype.poll.call(ctx), null);
  assert.equal(ctx.requests.length, 5);
});
