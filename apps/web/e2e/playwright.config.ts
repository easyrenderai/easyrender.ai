import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import { APP_ORIGIN, MOCK_ORIGIN, MOCK_TOKEN } from './paid-flow/endpoints';

// `bun run e2e` (apps/web): starts the Replicate stand-in and `next dev` against a scratch
// Postgres, then runs every spec here. Stripe is absent, so checkout is the dev checkout, and
// Replicate is the mock, so nothing is charged anywhere.
//
// Needs DATABASE_URL to point at a local scratch database that already has the schema
// (`bun run --cwd packages/db db:push`). The suite signs up users, so it refuses anything that is
// not on this machine.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('e2e needs DATABASE_URL pointing at a local scratch database');
}

// The older specs each read their own base URL variable: they all target the one local app.
for (const name of ['ANALYTICS_BASE_URL', 'PRICING_E2E_URL', 'QA_BASE_URL', 'LOCALIZED_E2E_URL']) {
  process.env[name] = APP_ORIGIN;
}
process.env.LOCALIZED_TEST_DATABASE_URL = databaseUrl;

// Results and uploads live outside apps/web: files written inside the project make `next dev`
// reload the page under test.
const output =
  process.env.EVIDENCE_DIR || fileURLToPath(new URL('../../../.data/e2e', import.meta.url));
const webRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  testDir: '.',
  outputDir: `${output}/playwright-artifacts`,
  testMatch: ['*.spec.ts', 'paid-flow/*.spec.ts'],
  globalSetup: './global-setup.ts',
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: `${output}/playwright-results.json` }],
    ...(process.env.CI ? ([['github']] as const) : []),
  ],
  use: {
    headless: true,
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: 'bun e2e/paid-flow/replicate-mock.ts',
      cwd: webRoot,
      url: `${MOCK_ORIGIN}/__health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'bunx next dev -p 3100',
      cwd: webRoot,
      url: `${APP_ORIGIN}/api/openapi.json`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        NEXT_TELEMETRY_DISABLED: '1',
        BETTER_AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret-1',
        BETTER_AUTH_URL: APP_ORIGIN,
        APP_URL: APP_ORIGIN,
        // No Stripe key: checkout is the dev checkout, which grants credits without a charge.
        STRIPE_SECRET_KEY: '',
        REPLICATE_API_TOKEN: MOCK_TOKEN,
        REPLICATE_API_BASE_URL: `${MOCK_ORIGIN}/v1`,
        // Many sign-ups and previews come from one address in a run.
        FREE_PREVIEWS_PER_DAY: '1000',
        DATA_DIR: join(tmpdir(), 'easyrender-e2e-storage'),
      },
    },
  ],
});
