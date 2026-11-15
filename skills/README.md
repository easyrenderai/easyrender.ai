# easyrender Agent Skill

[`easyrender-image-to-3d`](easyrender-image-to-3d/SKILL.md) guides a connected agent through
photo selection, preview review, current credit costs, authorized 3D builds, polling and GLB
delivery. It covers catalogue budgets and resuming requests without duplicate work.

## Install

Run from your project directory and choose a compatible agent:

```sh
npx skills add easyrenderai/easyrender.ai --skill easyrender-image-to-3d
```

Or choose Codex or Claude Code explicitly:

```sh
npx skills add easyrenderai/easyrender.ai --skill easyrender-image-to-3d --agent codex
npx skills add easyrenderai/easyrender.ai --skill easyrender-image-to-3d --agent claude-code
```

The installer requires Node.js/npm. Alternatively, copy the `easyrender-image-to-3d` folder into
your client's documented skill directory. Installation adds instructions; it does not connect
the MCP server, authenticate an account or authorize spending.

Connect your easyrender account using the [MCP setup guide](https://easyrender.ai/mcp#connect).
The instructions are in English; the agent should respond in the user's language.

Try: “Use the easyrender-image-to-3d skill to turn this product photo into a GLB. Show me the
preview and cost before spending any credits.”

The skill package is [MIT-licensed](easyrender-image-to-3d/LICENSE). Easyrender builds consume
account credits; your AI client may charge separately. See [current pricing](https://easyrender.ai/pricing).

## Maintenance

The workflow follows the tools in `packages/mcp/src/index.ts` and billing/status behavior in
`packages/core/src/renders.ts`. Keep its references current when those contracts change.

This package is separate from the category-specific engine prompt recipes in
[easyrenderai/skills](https://github.com/easyrenderai/skills). It is not loaded by the rendering
harness or added to that repository's `skills.json` manifest.
