const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const root = join(__dirname, '..');
const read = (name) => JSON.parse(readFileSync(join(root, name), 'utf8'));

test('all JSON panels parse and contain balanced IML delimiters', () => {
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.json')) {
        const text = readFileSync(path, 'utf8');
        JSON.parse(text);
        assert.equal((text.match(/{{/g) || []).length, (text.match(/}}/g) || []).length, path);
      }
    }
  }
  walk(root);
});
test('all modules have complete builder panels and date outputs use parseDate', () => {
  for (const module of read('app.json').modules) {
    const prefix = `modules/${module.name}/`;
    const comm = read(`${prefix}communication.json`);
    assert.ok(comm.url);
    assert.ok(
      Array.isArray(
        read(`${prefix}${module.type === 'trigger' ? 'static-parameters' : 'parameters'}.json`),
      ),
    );
    assert.ok(read(`${prefix}samples.json`));
    for (const field of read(`${prefix}interface.json`)) {
      if (field.type === 'date') assert.match(comm.response.output[field.name], /parseDate/);
    }
  }
});
test('auth is stored as a password and redacted in both connection and base', () => {
  assert.equal(read('connection/parameters.json')[0].type, 'password');
  for (const path of ['base.json', 'connection/communication.json']) {
    const definition = read(path);
    assert.ok(definition.log.sanitize.includes('request.headers.authorization'));
    assert.ok(definition.response.error['401']);
    assert.ok(definition.response.error['429']);
  }
  assert.equal(read('connection/communication.json').url, 'https://easyrender.ai/api/credits');
});
test('creation is private and idempotent; list follows opaque cursors', () => {
  const create = read('modules/createRender/communication.json');
  assert.equal(create.body.isPublic, false);
  assert.equal(create.headers['Idempotency-Key'], '{{parameters.idempotencyKey}}');
  const list = read('modules/listRenders/communication.json');
  assert.equal(list.pagination.qs.cursor, '{{body.nextCursor}}');
  assert.equal(list.pagination.condition, '{{!!body.nextCursor}}');
  assert.equal(list.qs.limit, 100);
});
test('trigger uses a single ID and never checkpoints a preview as a ready model', () => {
  const trigger = read('modules/modelReady/communication.json');
  assert.equal(
    trigger.response.iterate.condition,
    '{{item.status === "ready" && item.hasModel === true}}',
  );
  assert.equal(trigger.response.trigger.id, '{{item.id}}');
  assert.equal(trigger.response.trigger.type, 'id');
  assert.match(trigger.response.valid, /failed/);
  assert.ok(
    read('modules/modelReady/static-parameters.json').find((field) => field.name === 'id').required,
  );
});
test('universal API calls cannot redirect credentials to another host', () => {
  const universal = read('modules/apiCall/communication.json');
  assert.equal(universal.url, 'https://easyrender.ai/api{{parameters.url}}');
  const url = read('modules/apiCall/parameters.json').find((field) => field.name === 'url');
  const allowed = new RegExp(url.validate.pattern);
  assert.ok(allowed.test('/renders/r_1'));
  for (const value of ['https://example.com', '//example.com', '/../../elsewhere', '/renders?x=y'])
    assert.equal(allowed.test(value), false);
});
