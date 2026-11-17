import { expect, it } from 'vitest';
import { BROWSER_EXTENSION_ERRORS, EXPECTED_SERVER_ERRORS } from './sentry-noise';

const isExpected = (patterns: RegExp[], message: string) =>
  patterns.some((pattern) => pattern.test(message));

it('drops the MCP client mistakes Sentry reported as server errors', () => {
  for (const message of [
    'Pass an easyrender API key as Authorization: Bearer er_...',
    'Bad Request: Unsupported protocol version: 2026-07-28 (supported: 2025-11-25)',
    'Error: Bad Request: Parse error: Invalid JSON',
    'Not Acceptable: Client must accept both application/json and text/event-stream',
  ])
    expect(isExpected(EXPECTED_SERVER_ERRORS, message)).toBe(true);
});

it('keeps real server failures', () => {
  for (const message of [
    '3D render timed out',
    'Error: MCP request failed',
    'Invalid or expired API key',
    "Cannot read properties of undefined (reading 'userId')",
  ])
    expect(isExpected(EXPECTED_SERVER_ERRORS, message)).toBe(false);
});

it('drops the wallet extension proxy error but keeps our own proxy bugs', () => {
  expect(
    isExpected(
      BROWSER_EXTENSION_ERRORS,
      "TypeError: 'set' on proxy: trap returned falsish for property 'defaultAddress'",
    ),
  ).toBe(true);
  expect(
    isExpected(
      BROWSER_EXTENSION_ERRORS,
      "TypeError: 'set' on proxy: trap returned falsish for property 'cart'",
    ),
  ).toBe(false);
});
