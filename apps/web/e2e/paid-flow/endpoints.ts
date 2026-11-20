// Where the paid-flow test finds the app and the Replicate stand-in. Fixed ports, loopback only.
export const APP_ORIGIN = 'http://localhost:3100';
export const MOCK_PORT = 3917;
export const MOCK_ORIGIN = `http://127.0.0.1:${MOCK_PORT}`;
// The token the app is given and the mock insists on, so a client that stops sending it fails.
export const MOCK_TOKEN = 'e2e-replicate-token';
