import { expect, it } from 'vitest';
import {
  BLOB_URL_SPANS,
  BROWSER_ABORT_ERRORS,
  BROWSER_EXTENSION_ERRORS,
  EXPECTED_SERVER_ERRORS,
  WEBGL_UNAVAILABLE_ERRORS,
} from './sentry-noise';

const isExpected = (patterns: RegExp[], message: string) =>
  patterns.some((pattern) => pattern.test(message));

it('drops the MCP client mistakes Sentry reported as server errors', () => {
  for (const message of [
    'Pass an easyrender API key as Authorization: Bearer er_...',
    'Bad Request: Unsupported protocol version: 2026-07-28 (supported: 2025-11-25)',
    'Error: Bad Request: Parse error: Invalid JSON',
    'Not Acceptable: Client must accept both application/json and text/event-stream',
    'sheet rejected (sheet_repeated_views): the sheet repeats the same view',
    'Error: sheet rejected (sheet_inconsistent_structure): views disagree',
    'Error: Prediction failed: Async prediction failed: ModelError: The input or output was flagged as sensitive. Please try again with different inputs. (E005) (uIJ6l3ruRD): Prompt was flagged by safety filters (finishReason=IMAGE_SAFETY).',
    'Error: Prediction failed: ... Prompt was blocked by safety filters (blockReason=PROHIBITED_CONTENT).',
    'Error: Invalid Server Actions request.',
    // The SDK's answer to `initialize` with empty params, as Sentry reported it.
    JSON.stringify(
      [{ code: 'invalid_type', path: ['params', 'protocolVersion'], message: 'expected string' }],
      null,
      2,
    ),
  ])
    expect(isExpected(EXPECTED_SERVER_ERRORS, message)).toBe(true);
});

it('keeps real server failures', () => {
  for (const message of [
    '3D render timed out',
    'Error: MCP request failed',
    'Invalid or expired API key',
    "Cannot read properties of undefined (reading 'userId')",
    'model rejected (model_empty): nothing to show',
    'the sheet rejected our request',
    'Prediction failed: Out of memory',
    'Invalid server response',
    JSON.stringify([{ code: 'invalid_type', path: ['items', 0, 'id'], message: 'bad' }], null, 2),
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

it('drops the WebGL startup failure of a browser without WebGL', () => {
  expect(isExpected(WEBGL_UNAVAILABLE_ERRORS, 'Error: Error creating WebGL context.')).toBe(true);
  expect(isExpected(WEBGL_UNAVAILABLE_ERRORS, 'WebGL is not available')).toBe(true);
  expect(isExpected(WEBGL_UNAVAILABLE_ERRORS, 'Shader compile failed')).toBe(false);
});

it('drops blob: URL spans but keeps real network spans', () => {
  expect(isExpected(BLOB_URL_SPANS, 'GET blob:https://easyrender.ai/3f1c-uuid')).toBe(true);
  expect(isExpected(BLOB_URL_SPANS, 'GET https://easyrender.ai/api/renders')).toBe(false);
});

it('drops the aborted viewer fetch and the stackless Event rejection but keeps real rejections', () => {
  for (const message of [
    'AbortError: signal is aborted without reason',
    'Event: Event `Event` (type=error) captured as promise rejection',
  ])
    expect(isExpected(BROWSER_ABORT_ERRORS, message)).toBe(true);
  for (const message of ['TypeError: Failed to fetch', 'Error: viewer unavailable'])
    expect(isExpected(BROWSER_ABORT_ERRORS, message)).toBe(false);
});
