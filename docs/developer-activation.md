# API and MCP activation

## Existing account and payment

Web, REST and MCP spend the same account wallet. A key is a credential, not a separate account
or subscription. OAuth signs the client into an existing account. API keys can be scoped,
expire, and have a lifetime gross-debit allowance. Refunds restore the wallet but do not restore
that key allowance. Read current account-specific prices from `get_credits` or `GET /api/credits`;
do not infer a user's rate from a marketing screenshot or a nominal credit value.

Connecting, checking a key and consulting a balance do not start a paid generation. A successful
verification shows the credential's account, balance, scopes, expiry and allowance; it does not
prove a third-party client has completed an MCP handshake. The first client task should be:

> Use easyrender to read my credit balance and available operations. Do not create a preview,
> generate a model or spend credits.

The credential verification endpoint requires an explicit bearer key; a browser session cannot
substitute for it. When signed in, a different account's key is rejected. Credentials stay in the
request header, are not stored in browser storage and are not sent as analytics properties.

## First usable model

Use [the REST examples](../examples/rest/README.md) for Python or TypeScript. They default to a
preview and quote; a paid operation needs explicit approval and a ceiling. Persist the returned
render ID. After an interrupted request, read that job rather than creating another. A GLB link
is not completion evidence: require `status: ready` and `hasModel: true`, then download with the
owner credential. Verify the file opens before reporting a usable result.

For MCP use the [agent workflow](../skills/easyrender-image-to-3d/references/workflows.md).
Tool permissions and remaining account balance are necessary but do not by themselves authorize
spending. Quote approval can already be given in the user's task; do not ask for it again when
the authorized budget and conditions apply.

## Demonstration evidence

The integration landings show actual repository showcase assets (input, angle sheet and
interactive downloadable GLB). The armchair's materials were adjusted and its textures compressed
for the web. The workflow conversation and API response are illustrative. No elapsed production
time or historical debit is invented for these assets. The visible cost section uses current
pricing, not a receipt for the historical showcase.

To record a real run, use the example's local receipt output alongside an operator-authorized
production job, inspect the GLB and reconcile the debit. A resumed invocation's elapsed time is
not the full job's latency. Keep the receipt private until its identifiers and any account data
are reviewed for publication. Production delivery, recovery and upload cleanup are tracked in
[issue #173](https://github.com/easyrenderai/easyrender.ai/issues/173).

## Measurement and interpretation

- `landing_view` distinguishes `mcp` and `api` (including localized routes).
- `integration_action` records a fixed channel and action: setup, sample download, Python or
  TypeScript example, or API reference. It does not include a destination URL or credential.
- `integration_setup_copy` means a configuration was copied, not that a client connected.
- `integration_key_verified` uses channel `shared`: both REST and MCP use these credentials.
- Browser events use the existing analytics policy and `captureBrowser`. PostHog remains
  cookieless, memory-only and without person profiles; GA consent behavior is unchanged.
- The internal product analytics report uses operational render data for API/MCP/web 3D
  activation. A cohort is accounts whose first render request in that channel falls in the
  selected range. First and second distinct completed models are counted separately.
- The immutable first-completion timestamp survives a later edit or rebuild. Historical successes
  with no completion timestamp are disclosed separately, not assigned their mutable `updatedAt`.
- The same account may appear in more than one channel; do not sum channels as unique people.
  Anonymous previews and product-view-only use are not authenticated 3D activation.
- Recent cohorts have had less time to repeat. Compare equal observation windows before making
  retention claims. An account can generate two assets in one batch; that shows repeated
  generation, not necessarily returning on another day or buying credits twice.
- Anonymous landing events and operational accounts are different populations. Do not divide
  one by the other and call it a user conversion rate. Purchases remain authoritative billing
  events; generating a model is not evidence of a purchase.

## Beta operation

The prepared protocol and unsent invitation are in
[issue #177](https://github.com/easyrenderai/easyrender.ai/issues/177). Participants, invitations,
real spending and observed outcomes are recorded separately from implementation completion.
The first cohort is a usability pilot, not a statistically powered pricing experiment.

Customer completion webhooks are a potential follow-up after observing integration needs. They
are not implemented by these examples: the supported completion contract is bounded polling.
