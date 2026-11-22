# MCP client support for a harness-agnostic server

Type: research
Status: resolved
Blocked by: –
Map: [Archidocs v1](../map.md)

## Question

Which MCP features (tools, resources, prompts, structured tool output, sampling, elicitation) and transports (stdio, Streamable HTTP) do the major clients actually support today: Claude Code, Claude Desktop, Cursor, VS Code / Copilot, ChatGPT, Windsurf, Codex CLI, Gemini CLI? And what is the most portable way to deliver authoring guidance (served through MCP tools or prompts, the Agent Skills SKILL.md format, AGENTS.md)?

## Answer

**Tools are the only MCP feature all eight clients support.** The current spec revision is 2026-07-28: it removed the initialize handshake and sessions, and deprecated Sampling, Roots, Logging and SSE. The official clients feature matrix was taken down on 2026-05-27, so support was checked against each client's own docs, with the last copy of that page as weaker evidence.

- **Rely on:** stateless tools that return `structuredContent` plus a text copy of the same data.
- **Optional extras:** server instructions, resources, prompts, elicitation, MCP Apps, and the Skills-over-MCP extension.
- **Don't use:** Sampling or Roots.
- **Transports:** stdio first, then Streamable HTTP from the same server; no SSE. Build on TypeScript SDK v2 (≥ 2.4.0) so it works with clients on the new spec revision and with older ones; most clients still use the old handshake.
- **Authoring guidance:** serve it through a `get_authoring_guide` tool, because prompts are missing in ChatGPT, Codex and VS Code Copilot. Also ship one SKILL.md, which `archidocs init` copies into `.agents/skills`, `.claude/skills` and `.github/skills`, and add a short pointer in AGENTS.md.
- **Unconfirmed:** most clients don't document how they handle structured output. Windsurf documents only tools and transports. ChatGPT's partial Skills support couldn't be checked.

Findings, with the full client-by-feature table: [research/03-mcp-client-support.md](../research/03-mcp-client-support.md)
