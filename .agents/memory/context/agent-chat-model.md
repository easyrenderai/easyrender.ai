---
name: agent-chat-model
description: Which model powers the app's Agent chat, why, and where the spec lives
type: project
---

The Agent area (chat over easyrender's own MCP tools, PR #341) runs on one small, cheap Claude
model called through OpenRouter's Anthropic-compatible endpoint, with the key in
`OPENROUTER_API_KEY`. The owner chose OpenRouter over Anthropic direct and no model picker
(2026-11-22).

**Why:** the cheapest model that handles the tool loop keeps a turn to a fraction of a credit,
because chat tokens are charged in credits at provider cost plus the one margin.
**How to apply:** the model id and per-token prices live in `packages/harness/src/pricing.ts`
(`AGENT_MODEL`); read them there. The spec and other decisions (in-process MCP tools, approval card
for paid steps, micro-credit carry) are in `docs/agent-chat.md`. The page stays off until the key is
set in Vercel.
