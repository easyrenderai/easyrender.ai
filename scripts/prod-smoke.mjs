import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

/**
 * Read-only production smoke. It never signs in, uploads, pays or sends a key: seven GET/POST
 * requests that any anonymous visitor or agent can make. Each check gets one retry. Every response
 * is inspected for `x-vercel-mitigated` (the edge refusing a request), including the ones that a
 * retry later recovers, so the run summary shows how often the edge pushed back.
 */

const isJson = (response) => (response.headers.get('content-type') ?? '').includes('json');
const isHtml = (response) => (response.headers.get('content-type') ?? '').includes('text/html');

async function jsonBody(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export const CHECKS = [
  { name: 'home', path: '/', verify: async (response) => isHtml(response) || 'not HTML' },
  { name: 'pricing', path: '/pricing', verify: async (response) => isHtml(response) || 'not HTML' },
  {
    name: '3d-viewer',
    path: '/3d-viewer',
    verify: async (response) => isHtml(response) || 'not HTML',
  },
  {
    name: 'openapi',
    path: '/api/openapi.json',
    verify: async (response) => {
      const body = await jsonBody(response);
      return (isJson(response) && typeof body?.openapi === 'string') || 'not an OpenAPI document';
    },
  },
  {
    name: 'oauth-protected-resource',
    path: '/.well-known/oauth-protected-resource',
    verify: async (response) => {
      const body = await jsonBody(response);
      return (isJson(response) && typeof body?.resource === 'string') || 'no resource in metadata';
    },
  },
  {
    name: 'oauth-authorization-server',
    path: '/.well-known/oauth-authorization-server',
    verify: async (response) => {
      const body = await jsonBody(response);
      return (isJson(response) && typeof body?.issuer === 'string') || 'no issuer in metadata';
    },
  },
  {
    name: 'mcp-unauthenticated',
    path: '/api/mcp',
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'get_credits', arguments: {} },
    }),
    expectStatus: 401,
    verify: async (response) => {
      const body = await jsonBody(response);
      if (body?.error?.data?.code !== 'unauthorized') return 'not the unauthorized JSON error';
      return (
        (response.headers.get('www-authenticate') ?? '').startsWith('Bearer') || 'no challenge'
      );
    },
  },
];

/** One attempt: a failure is a string, success is undefined. `mitigated` is the header value. */
async function attempt(baseUrl, check, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(new URL(check.path, baseUrl), {
      method: check.method ?? 'GET',
      headers: { 'user-agent': 'easyrender-prod-smoke', ...check.headers },
      ...(check.body ? { body: check.body } : {}),
      signal: AbortSignal.timeout(20_000),
      redirect: 'manual',
    });
  } catch (error) {
    return { failure: `request failed: ${error instanceof Error ? error.message : error}` };
  }
  const mitigated = response.headers.get('x-vercel-mitigated') ?? undefined;
  const expected = check.expectStatus ?? 200;
  if (response.status !== expected) {
    const edge = mitigated ? ` (edge refused: x-vercel-mitigated ${mitigated})` : '';
    await response.body?.cancel().catch(() => undefined);
    return { mitigated, failure: `HTTP ${response.status}, expected ${expected}${edge}` };
  }
  const verdict = await check.verify(response);
  return { mitigated, ...(verdict === true ? {} : { failure: verdict }) };
}

export async function runSmoke(
  baseUrl,
  { fetchImpl = fetch, sleep = delay, retryDelayMs = 5000, checks = CHECKS } = {},
) {
  const results = [];
  const mitigated = {};
  for (const check of checks) {
    const attempts = [];
    for (let tries = 0; tries < 2; tries += 1) {
      if (tries > 0) await sleep(retryDelayMs);
      const result = await attempt(baseUrl, check, fetchImpl);
      attempts.push(result);
      if (result.mitigated !== undefined)
        mitigated[result.mitigated] = (mitigated[result.mitigated] ?? 0) + 1;
      if (!result.failure) break;
    }
    const last = attempts[attempts.length - 1];
    results.push({
      name: check.name,
      path: check.path,
      isOk: !last.failure,
      attempts: attempts.length,
      failure: last.failure,
    });
  }
  const mitigatedCount = Object.values(mitigated).reduce((sum, count) => sum + count, 0);
  return {
    baseUrl,
    results,
    isOk: results.every((result) => result.isOk),
    mitigatedCount,
    mitigated,
  };
}

export function formatSummary(report) {
  const lines = [
    `## Production smoke: ${report.isOk ? 'passed' : 'FAILED'}`,
    '',
    `Target: ${report.baseUrl}`,
    '',
    '| Check | Path | Result | Attempts |',
    '| --- | --- | --- | --- |',
    ...report.results.map(
      (result) =>
        `| ${result.name} | \`${result.path}\` | ${result.isOk ? 'ok' : `FAILED: ${result.failure}`} | ${result.attempts} |`,
    ),
    '',
    `Responses with \`x-vercel-mitigated\`: **${report.mitigatedCount}**${
      report.mitigatedCount
        ? ` (${Object.entries(report.mitigated)
            .map(([action, count]) => `${action}: ${count}`)
            .join(', ')})`
        : ''
    }`,
    '',
  ];
  return lines.join('\n');
}

async function main() {
  // Workflow-only inputs; this script does not run through Turbo.
  const { PRODUCTION_URL, SMOKE_RETRY_DELAY_MS, GITHUB_STEP_SUMMARY } = process.env;
  const baseUrl = PRODUCTION_URL || process.argv[2] || 'https://easyrender.ai';
  const report = await runSmoke(baseUrl, { retryDelayMs: Number(SMOKE_RETRY_DELAY_MS ?? 5000) });
  const summary = formatSummary(report);
  console.log(summary);
  if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${summary}\n`);
  if (!report.isOk) {
    for (const result of report.results.filter((item) => !item.isOk))
      console.log(`::error title=Production smoke::${result.path} ${result.failure}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
