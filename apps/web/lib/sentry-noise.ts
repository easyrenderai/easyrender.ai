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
];

// Wallet and address-autofill extensions patch the page and throw from their own injected script.
export const BROWSER_EXTENSION_ERRORS: RegExp[] = [
  /'set' on proxy: trap returned falsish for property 'defaultAddress'/,
];
export const BROWSER_EXTENSION_URLS: RegExp[] = [/\/injected\/injected\.js/];
