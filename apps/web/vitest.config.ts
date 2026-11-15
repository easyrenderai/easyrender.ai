import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for the pure parts: the route registry, the sitemaps and the content loader. No
// Next.js runtime, no database, no network.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  // Content/sitemap suites parse the six-language corpus. Bound parallel disk/CPU work when
  // preflight also runs the core and harness suites; keep the normal test timeout unchanged.
  test: { environment: 'node', include: ['lib/**/*.test.ts'], maxWorkers: 2 },
});
