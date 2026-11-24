// Failures that are the caller's or the browser's doing, not ours. Sentry's MCP integration reports
// every JSON-RPC error response and transport error, so a client without an API key or one that
// speaks a newer protocol version looked like a server bug. Matching is against the error message.
export const EXPECTED_SERVER_ERRORS: RegExp[] = [
  // MCP_UNAUTHORIZED_MESSAGE in packages/mcp: an anonymous client calling a private tool.
  /Pass an easyrender API key as Authorization/,
  // The MCP SDK rejecting a client that sends a protocol version we do not list.
  /Unsupported protocol version/,
  // Malformed MCP requests are refused by the SDK transport with a "Bad Request:" message.
  /^(?:Error: )?Bad Request: /,
  // The SDK's 406 for a client whose Accept header lacks application/json or text/event-stream.
  // The client gets a JSON-RPC error that names the fix.
  /^(?:Error: )?Not Acceptable: /,
  // The sheet quality gate in packages/core refusing a bad generation (repeated views, inconsistent
  // structure). The render fails and is refunded by design, with no retry, so it is not a bug.
  /^(?:Error: )?sheet rejected \(/,
  // A provider's content moderation refusing a photo or prompt (Replicate E005, Gemini
  // IMAGE_SAFETY and PROHIBITED_CONTENT). The render fails and is refunded, the buyer sees it.
  /\(E005\)|(?:flagged|blocked) by safety filters/,
  // A scanner or broken client sending MCP `initialize` with empty params. The SDK answers with
  // a JSON-RPC error that lists the missing fields, so the caller learns what to fix.
  /"path":\s*\[\s*"params",\s*"(?:protocolVersion|capabilities|clientInfo)"\s*\]/,
  // A Server Actions POST whose Origin is `null` (a privacy browser, a sandboxed frame or a
  // scanner probing the home page). Next refuses it by design.
  /^(?:Error: )?Invalid Server Actions request/,
];

// Wallet and address-autofill extensions patch the page and throw from their own injected script.
export const BROWSER_EXTENSION_ERRORS: RegExp[] = [
  /'set' on proxy: trap returned falsish for property 'defaultAddress'/,
];
export const BROWSER_EXTENSION_URLS: RegExp[] = [/\/injected\/injected\.js/];

// A browser with no WebGL (a headless crawler, a blocklisted GPU) cannot start the 3D sections. They
// stay as the page's still images, so three.js throwing at startup is the environment, not a bug.
export const WEBGL_UNAVAILABLE_ERRORS: RegExp[] = [
  /Error creating WebGL context/,
  /WebGL is not available/,
];

// Errors the browser raises on its own, with nothing of ours in the stack. A fast navigation aborts
// the page's in-flight fetch (the viewer call): the AbortError reaches `unhandledrejection` with no
// message of ours. A bare `Event` rejection carries no stack or message at all, so it cannot be fixed.
export const BROWSER_ABORT_ERRORS: RegExp[] = [
  /AbortError: signal is aborted without reason/,
  /Event `Event` \(type=error\) captured as promise rejection/,
];

// The 3D viewer reads its embedded textures back through in-memory blob: URLs. They are not network
// requests, but Sentry's N+1 detector counted five of them on /image-to-3d-api as repeated calls.
export const BLOB_URL_SPANS: RegExp[] = [/^GET blob:/];
