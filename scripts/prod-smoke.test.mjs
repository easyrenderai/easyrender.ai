import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { formatSummary, runSmoke } from './prod-smoke.mjs';

const run = promisify(execFile);
const script = new URL('./prod-smoke.mjs', import.meta.url).pathname;

const MCP_BODY = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  error: { code: -32000, message: 'Pass a key', data: { code: 'unauthorized', status: 401 } },
});

/** Answers like production does. `override` can change one path's response. */
function respond(request, response, override) {
  const forced = override?.(request.url, request.method);
  if (forced) {
    response.writeHead(forced.status, forced.headers ?? {});
    response.end(forced.body ?? '');
    return;
  }
  const path = request.url;
  if (path === '/api/mcp' && request.method === 'POST') {
    response.writeHead(401, {
      'content-type': 'application/json',
      'www-authenticate': 'Bearer resource_metadata="https://example.test/.well-known/x"',
    });
    response.end(MCP_BODY);
  } else if (path === '/api/openapi.json') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"openapi":"3.1.0"}');
  } else if (path === '/.well-known/oauth-protected-resource') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"resource":"https://example.test/api/mcp"}');
  } else if (path === '/.well-known/oauth-authorization-server') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('{"issuer":"https://example.test"}');
  } else if (['/', '/pricing', '/3d-viewer'].includes(path)) {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<html></html>');
  } else {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('missing');
  }
}

async function withServer(override, callback) {
  const server = createServer((request, response) => respond(request, response, override));
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((done) => server.close(done));
  }
}

const options = { retryDelayMs: 0, sleep: async () => undefined };

test('a healthy site passes every check with no retries', async () => {
  await withServer(undefined, async (baseUrl) => {
    const report = await runSmoke(baseUrl, options);
    assert.equal(report.isOk, true);
    assert.equal(report.results.length, 7);
    assert.ok(report.results.every((result) => result.attempts === 1));
    assert.equal(report.mitigatedCount, 0);
  });
});

test('a path that answers 404 fails the run', async () => {
  await withServer(
    (path) => (path === '/pricing' ? { status: 404 } : undefined),
    async (baseUrl) => {
      const report = await runSmoke(baseUrl, options);
      assert.equal(report.isOk, false);
      const failed = report.results.filter((result) => !result.isOk);
      assert.deepEqual(
        failed.map((result) => result.path),
        ['/pricing'],
      );
      assert.equal(failed[0].attempts, 2);
      assert.match(failed[0].failure, /HTTP 404, expected 200/);
    },
  );
});

test('an edge refusal that clears on the retry passes and is counted', async () => {
  let isFirstRequest = true;
  await withServer(
    (path) => {
      if (path !== '/' || !isFirstRequest) return undefined;
      isFirstRequest = false;
      return { status: 403, headers: { 'x-vercel-mitigated': 'deny' } };
    },
    async (baseUrl) => {
      const report = await runSmoke(baseUrl, options);
      assert.equal(report.isOk, true);
      assert.equal(report.results[0].attempts, 2);
      assert.equal(report.mitigatedCount, 1);
      assert.deepEqual(report.mitigated, { deny: 1 });
      assert.match(formatSummary(report), /x-vercel-mitigated`: \*\*1\*\* \(deny: 1\)/);
    },
  );
});

test('an edge refusal that persists fails and names the edge', async () => {
  await withServer(
    (path) =>
      path === '/3d-viewer'
        ? { status: 403, headers: { 'x-vercel-mitigated': 'deny' } }
        : undefined,
    async (baseUrl) => {
      const report = await runSmoke(baseUrl, options);
      assert.equal(report.isOk, false);
      assert.equal(report.mitigatedCount, 2);
      assert.match(report.results.find((result) => !result.isOk).failure, /edge refused/);
    },
  );
});

test('the MCP check fails when the endpoint answers 200 instead of 401', async () => {
  await withServer(
    (path, method) =>
      path === '/api/mcp' && method === 'POST'
        ? { status: 200, headers: { 'content-type': 'application/json' }, body: '{}' }
        : undefined,
    async (baseUrl) => {
      const report = await runSmoke(baseUrl, options);
      assert.equal(report.isOk, false);
      assert.equal(report.results.find((result) => !result.isOk).name, 'mcp-unauthenticated');
    },
  );
});

test('a body that is not the expected document fails', async () => {
  await withServer(
    (path) =>
      path === '/api/openapi.json'
        ? { status: 200, headers: { 'content-type': 'text/html' }, body: '<html></html>' }
        : undefined,
    async (baseUrl) => {
      const report = await runSmoke(baseUrl, options);
      assert.equal(report.isOk, false);
      assert.match(report.results.find((result) => !result.isOk).failure, /OpenAPI/);
    },
  );
});

test('the script exits 0 on a healthy site and non-zero on a wrong path', async () => {
  await withServer(undefined, async (baseUrl) => {
    const env = { ...process.env, PRODUCTION_URL: baseUrl, SMOKE_RETRY_DELAY_MS: '0' };
    const healthy = await run('node', [script], { env });
    assert.match(healthy.stdout, /Production smoke: passed/);
  });
  await withServer(
    (path) => (path === '/api/openapi.json' ? { status: 404 } : undefined),
    async (baseUrl) => {
      const env = { ...process.env, PRODUCTION_URL: baseUrl, SMOKE_RETRY_DELAY_MS: '0' };
      await assert.rejects(run('node', [script], { env }), (error) => {
        assert.notEqual(error.code, 0);
        assert.match(error.stdout, /Production smoke: FAILED/);
        assert.match(error.stdout, /::error title=Production smoke::\/api\/openapi.json/);
        return true;
      });
    },
  );
});
