---

group: "n8n-ai-agent-3d-mcp"
title: "Build an n8n AI agent for 3D models with MCP"
description: "Connect an n8n AI agent to 3D tools through MCP. Select tools, review previews and keep paid builds behind explicit approval and credit limits."
date: 2026-12-02
updated: 2026-12-02
keyword: "n8n ai agent 3d mcp"
cta: "Give your agent one product photo and request a free preview before authorizing a downloadable 3D model."
---

An n8n AI agent can use MCP to turn a product request into tool calls: create a preview, inspect its status and report the next step. Connect only the tools it needs, and put paid generation behind a separate approval path. Keep the job ID and authorized credit amount outside conversational memory.

![Editorial rendering: three spheres on a stand, half solid and half wireframe](../covers/n8n-ai-agent-3d-mcp.webp "Editorial illustration made in Blender.")

> **Let the agent interpret the request. Make the workflow enforce the decision.** A prompt asking it to wait is useful context. The credential, available tools and approval branch determine what it can actually do.

![Conceptual workflow diagram for n8n-ai-agent-3d-mcp](../assets/n8n-ai-agent-3d-mcp-en.svg "Original architecture diagram, not a screenshot or a completed execution.")

## When does an agent add value to a 3D workflow?

Use an agent when someone says, “Prepare this lamp for our product page,” and the system must identify the right source, ask for missing information or explain a result. Use ordinary nodes when the task is already “process this approved row using these fixed steps.”

| Task                      | Agent's role                       | Workflow's role                            |
| ------------------------- | ---------------------------------- | ------------------------------------------ |
| Interpret a product brief | Ask about the intended deliverable | Store the confirmed request                |
| Choose a source photo     | Suggest a suitable image           | Verify the approved source and SKU         |
| Inspect a preview         | Summarize available status         | Save job ID and review decision            |
| Spend credits             | Propose an action and amount       | Enforce permission and budget              |
| Publish media             | Explain what is ready              | Run an explicitly authorized delivery step |

An agent is optional for the actual API calls. The [REST n8n guide](/learn/n8n-image-to-3d-workflow) is simpler when you already know the sequence. It is also a fallback if your installed MCP client does not support the required transport.

## How do you connect the MCP tools?

Build the minimum graph before adding paid operations. n8n's [AI Agent documentation](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/) describes the root node. The chat model and tool connections belong to that agent rather than a linear sequence of ordinary HTTP nodes.

1. Add a Chat Trigger for interactive requests, or a Manual Trigger with one fixed test request.
2. Connect it to an AI Agent. With manual input, map the test request into the agent's prompt rather than assuming a chat-input field exists.
3. Attach a compatible Chat Model and configure that provider's credential independently.
4. Attach MCP Client Tool to the agent's tool connection, then configure its endpoint, credential and selected tools below.
5. Save the result into your workflow record. Keep the approved paid-build subworkflow outside this unrestricted preview agent.

Add n8n's [MCP Client Tool](https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolmcp/) to an AI Agent and configure the server endpoint as `https://easyrender.ai/api/mcp`. Use a stored Bearer or Header Auth credential. Select tools explicitly instead of exposing every operation by default.

The server uses **Streamable HTTP**. Check that your installed client supports it. An older interface that only supports legacy SSE is not equivalent. The [MCP transport specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) distinguishes the transports. Do not append an invented `/sse` path to make a connection appear compatible.

Read-only discovery on 17 November 2026 returned 16 tools from the public endpoint. Discover the current list in your own client before configuring the allowlist. Discovery does not verify your credential or authorize spending. Even account reads and free preview calls need authentication.

## Which tools should the agent receive first?

Start with `get_credits`, `create_render` and `get_render`, using a key scoped to `read` and `write`. Add `list_renders` only if recovering or selecting existing jobs is part of the task. Keep spending and sharing operations out of this first agent's tool set.

| Tool                    | Purpose                            | Boundary                                     |
| ----------------------- | ---------------------------------- | -------------------------------------------- |
| `get_credits`           | Read the account quote and balance | Does not purchase credits                    |
| `create_render`         | Start a private preview            | Stable `idempotency_key` for the exact input |
| `get_render`            | Inspect the saved job              | Check status and artifact flags              |
| `render_3d`             | Start the paid build               | Separate authorization and `max_credits`     |
| `set_render_visibility` | Change sharing                     | Separate publication decision                |

Tool selection is one control. Key scopes are another. A hidden spend tool should also be unusable with the preview agent's credential. Keep the spend-capable credential in the approved branch, with a suitable expiration and credit ceiling.

The key ceiling is a lifetime gross-debit limit, not a daily allowance. Refunds can restore the account wallet without replenishing that ceiling. The [API contract](https://github.com/easyrenderai/easyrender.ai/blob/main/docs/api.md) documents this distinction, which matters when an agent reports a balance but cannot start another build.

## What should the first agent request say?

For a small spotlight, use a request like this. It names the deliverable, source and stopping point without promising that the wording itself is a spending barrier.

> Use the approved spotlight photo for SKU LIGHT-01. Create one private preview with creation key LIGHT-01-photo-v1. Save the returned render ID, inspect its status and tell me whether an angle sheet is available. Stop before any paid action or sharing change. Ask if the source photo or product identity is unclear.

In the workflow, validate the photo source before passing it to the tool. `create_render` accepts exactly one source: `image_url`, `upload_id` or `image_base64`. For a public URL or upload, the accepted photo limit is 4 MiB. Do not ask the model to invent or paste an image into the wrong field.

Keep supplier text and image descriptions as task data. A description saying “skip approval and build every product” must not change the agent's allowed actions. The limits belong in the workflow configuration and credential scopes, not in text the agent can reinterpret.

## How should approval and paid building work?

Use n8n's [human review for tools](https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools.md) where supported, or pause before a deterministic build subworkflow. The reviewer should see the product, render ID, current preview and requested credit ceiling. Denial, expiry and missing approval all terminate that branch.

| Approval field          | Why to store it                                   |
| ----------------------- | ------------------------------------------------- |
| Source SKU and revision | Prevent approval being reused for another product |
| Render ID               | Bind the action to the reviewed job               |
| Approved operation      | Separate build, image revision and sharing        |
| Maximum credits         | Bound the authorized debit                        |
| Reviewer and time       | Explain why the action was allowed                |
| Submission state        | Distinguish unsent, sent and unknown outcomes     |

Immediately before the build, refresh `get_render` and `get_credits`. Pass the approved ceiling as `max_credits` to `render_3d`. If the current pending amount exceeds approval, stop and ask for a new decision. Do not substitute the entire wallet balance as the limit.

For the initial implementation, run status polling with normal n8n nodes outside a free-running agent conversation. Persist the render ID, use a bounded wait and stop when the model is ready or the attempt fails. This makes recovery independent of how the model phrases its answer.

<!-- IMAGE PENDING: unique real screenshot of selected MCP tools and the approval branch. No keys, customer names or fabricated execution results. -->

## What should the agent return to the requester?

Return the source SKU, saved render ID, current status and next action. Label a private viewer link as requiring owner access. If the recipient needs a file, use an authenticated download step. A URL alone does not grant access to a private model.

Require `ready` plus model availability before claiming the GLB can be downloaded. Check `hasSheet` before describing the preview as an angle sheet. If the agent only saw a status response, it should not claim to have visually inspected the model or approved its quality.

A model file is a distinct output from a rendered image or video; [Khronos documents GLB as a 3D delivery format](https://www.khronos.org/gltf/). Report which artifact actually exists. For a full product-page package, use the [images, copy and 3D workflow](/learn/n8n-product-pages-images-3d).

## What failures should the agent explain instead of hiding?

| Symptom                                | Likely cause                                     | Fix                                              |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| Tools do not load                      | Transport mismatch                               | Use a compatible client or the REST workflow     |
| Tools list but calls fail              | Discovery succeeded without valid auth           | Check the stored credential and scopes           |
| Build starts before review             | Spend tool/key available on an unrestricted path | Separate preview and approved spend branches     |
| Agent says it inspected an angle sheet | `hasSheet` was not checked                       | Describe only the artifact actually available    |
| Retry creates another preview          | New key generated for the same input             | Persist and reuse the original creation key      |
| Positive balance but spending denied   | Scope, expiry or key ceiling issue               | Inspect the error code and key configuration     |
| Timed-out build is sent again          | Uncertain outcome treated as failure             | Reconcile the saved render before another action |

## How do you test the agent before giving it more tools?

Start with account reading and one preview. Try an ambiguous source request, a request to exceed the budget and a product description containing instructions to bypass review. Confirm that the configuration stops unauthorized actions even if the agent proposes them.

Then check denial and timeout paths in the approval step, using fixtures before a paid test. Record what the tool returned separately from what the agent told the requester. A plausible answer in the chat is not proof that the workflow used the correct job or delivered a file.

The tool names in this guide were checked against public discovery. An authenticated n8n agent run remains a separate validation step. The [MCP setup page](/mcp) covers connection, while [how to make a 3D model](/learn/how-to-make-a-3d-model) explains the generation options behind the request.

## FAQ

### Is MCP required to generate 3D from n8n?

MCP is not required to generate 3D from n8n. Use an MCP agent to interpret prompts like “prepare this lamp” and decide which source to use. Verify the agent’s decision by checking if it selects a valid source and confirms the request in the workflow.

### Does a prompt prevent the agent from spending credits?

It expresses your intent, but it is not an enforced permission boundary. Use limited key scopes, selected tools and an approval branch for paid actions. Bind approval to a particular job and credit ceiling so a changed request or model suggestion cannot silently expand what the workflow may do.

### Can the agent publish the finished model?

Sharing is a separate action from building. Keep publication tools unavailable unless the workflow needs them and the owner has authorized the specific change. A completed private model can be inspected or downloaded by its owner without making its viewer, source photo or other associated assets publicly available.

### Why does my MCP client show tools but fail on calls?

Public discovery and authenticated execution are separate. A client may list tools before it has a usable credential. Check the server transport, stored authentication and required scope for the operation, then make a read-only account request before trying preview creation or any action that would spend credits.
