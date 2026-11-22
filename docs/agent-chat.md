# Agent chat: spec

The Agent area is a chat over easyrender's own MCP tools. A signed-in person talks to an agent; the
agent previews, checks and builds 3D models for them with the same tools an outside agent gets at
`/api/mcp`. Credits are the only unit. This file records the decisions and the why. Prices and
credit values live in `packages/harness/src/pricing.ts`; nothing here copies a number.

## Reference: how genfeed.ai builds its agent

Read from `genfeedai/genfeed.ai` (`apps/server/api/src/services/agent-orchestrator`). It is a real
tool-calling agent, not a chat wrapper:

- A server loop calls the model with a tool list, runs the tool calls the model returns, feeds the
  results back and repeats until the model answers (hard cap of 25 rounds, then a wrap-up round).
- The tools are one shared catalog (`@genfeedai/actions`) with a `creditCost` per tool and a
  per-surface filter. Handlers are dispatched by tool name, in process. The agent does not go
  through its MCP server; it shares the same actions.
- Each round is billed on its own: reserve the round's maximum, run it, settle at the provider's
  real cost times the margin, in fractional credits. A per-turn credit budget stops a turn that
  would overspend. Paid tools (media generation) return an approval card with a binding quote.
- Threads and messages are stored per thread; replies stream to the browser; the model is reached
  through OpenRouter with a model registry that holds each model's price.
- Much of the rest (plan mode, memory, goals, campaigns, sub-agents, onboarding) is product
  surface easyrender does not need.

easyrender keeps the same spine and drops the rest: loop, shared tools, per-turn credit guard,
approval card for paid actions, stored threads.

## Decisions

### Tools: the MCP server, in process

The agent's tool list is `createMcpServer(actor)` from `packages/mcp`, connected to an MCP client
over an in-memory transport. No new tool code, and a tool added for outside agents appears in the
chat. The actor is the signed-in user with no API key, so the existing ownership checks apply
(`assertActorScope` already lets browser sessions through) and every render stays scoped to its
owner. Renders made here have `source: 'mcp'`, so they show under "Made by your agents".

Paid tools never run on the model's say-so. `render_3d`, `rebuild_standard`, `start_sheet`-style
tools are marked spend. When the model calls one, the loop stops and returns an approval card
("Build 3D, N credits", N from the quote). The person's click sends the call again with
`max_credits` set to the quoted price, which the existing budget check enforces. Reads and free
previews run without a prompt.

### Model

The model is called through OpenRouter's Anthropic-compatible endpoint with the Anthropic SDK
(`@anthropic-ai/sdk`, key sent as a bearer token), with a per-round `max_tokens` and at most 8 tool
rounds per turn. Vincent chose Haiku 5.5 only and OpenRouter as the route (2026-11-22). OpenRouter
passes the provider's price through with no markup, so the price in `pricing.ts` is what a turn
costs. The request leaves out prompt-cache and effort fields until a real turn shows OpenRouter
passes them through. The prompt bar shows no model names, matching the render quality tiers.

### Charging

Chat tokens are charged in credits on the one margin rule: provider cost plus margin
(`creditsFor` in `pricing.ts`). Model prices per million tokens and a `agentTurnMicroCredits`
helper live in `pricing.ts`. The turn is charged once, in one transaction with the stored
assistant message, through `packages/core/src/credits.ts` with a ledger row
(`agent-turn:{messageId}`, reason `agent_chat`). A turn that fails before the provider returns
usage is not charged. Tool spend is separate and goes through the tools' own credit paths, so
refunds work the same.

Before a turn starts the balance must cover a worst-case turn (a cap derived from the round limit
and `max_tokens`), otherwise the composer shows "Add credits" and nothing runs. The credits link
is in the top bar of every signed-in page already.

### Storage

Postgres through Prisma, additive tables only (they deploy on their own, rule 14):

- `AgentChat`: id, userId, title, createdAt, updatedAt.
- `AgentMessage`: id, chatId, role, content (the model's content blocks as JSON), inputTokens,
  outputTokens, credits, createdAt.

Every query is scoped to `userId`. There is no public read. A title is the first user message,
trimmed. Photos attach through the existing `/api/uploads`; the model gets the image and the
`upload_id`.

### API and UI

- `POST /api/agent/chats` creates a chat, `GET /api/agent/chats` lists them,
  `GET /api/agent/chats/[id]` reads one.
- `POST /api/agent/chats/[id]/messages` runs a turn and streams server-sent events: text deltas,
  tool-call status, an approval card, the final message with credits used. `POST` on
  `.../approve` runs an approved paid tool.
- Page `/agent` in the app shell (rail item Agent), laid out as the prototype: chat list on the
  left with a New chat button, the conversation in the middle, composer at the bottom. Tool calls
  render as small cards (a finished preview shows the angle sheet), approval as a button that
  states its cost. Shadcn components only; states are loading, empty, success and error, and an
  error says whether credits were refunded.
- Below `md` the chat list moves behind a button, as the shell already does for drawers.

### Safety and keeping prod working

- The Agent area is off until `OPENROUTER_API_KEY` is set. Without it the page shows an
  unavailable state and the API answers 503. Nothing else changes.
- Tool results are data, not instructions. The system prompt says so, and the tool list is only
  the MCP tools: no shell, no web, no file access.
- Rate limit per user on turns, reusing `consumeApiRateLimit`.
- New env var: `OPENROUTER_API_KEY` in `.env.example` and `turbo.json`; it must be set in Vercel.

### Not in the first version

Memory across chats, plan mode, sub-agents, scheduled runs, file uploads other than photos, a
model picker.
