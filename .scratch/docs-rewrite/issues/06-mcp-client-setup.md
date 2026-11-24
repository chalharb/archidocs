# 06: Per-client MCP setup

Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

Rewrite `guides/agents/connect-mcp` so a reader finds their own client. Today it says "Register it the way your harness takes MCP servers" and shows one `.mcp.json`.

- **Tabs:** one each for Claude Code, Cursor, VS Code / Copilot and Codex ([ticket 01](01-decisions.md)), each with the exact file or command to register `archidocs mcp --workspace archidocs`. Start from `.scratch/archidocs-v1/research/03-mcp-client-support.md` and check each client's current docs.
- **Structure:** the how-to template from 07 if it has landed: outcome, before you start, steps, "Check it worked" with the question to ask and the tool call to expect (`get_impact`), then the variants (a code repo, a published site read-only, HTTP).
- **Wording:** "coding agent" or the client's name, not "harness", here and in the other five places the word is used.

## Acceptance criteria

- [ ] Each of the four clients has a tab with a config a reader can paste.
- [ ] Every `archidocs …` line and every `args` array passes the CLI-line check.
- [ ] "harness" appears on no hand-written page.
