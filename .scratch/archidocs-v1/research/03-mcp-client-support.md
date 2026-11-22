# MCP client support for a harness-agnostic server

Research for [issue 03](../issues/03-mcp-client-support.md). Sources were read on 2026-11-21 unless a different date is given. Client support changes every few weeks, so each claim carries the date or version its source gives.

## Short answer

- **Tools are the only MCP feature all eight clients support.** Every other feature is missing, hidden behind a setting, or undocumented in at least one major client.
- **The spec changed under us.** The current MCP revision is **2026-07-28** ([versioning](https://modelcontextprotocol.io/specification/versioning)). It removed the `initialize` handshake and protocol-level sessions, and it **deprecated Sampling, Roots and Logging** ([changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog), [deprecated registry](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)). Most clients still speak the older, "legacy" revisions, so a server has to serve both eras.
- **stdio and Streamable HTTP cover every client.** No client needs SSE. ChatGPT and claude.ai web connect only from their own cloud, so they need a public HTTPS endpoint.
- **For authoring guidance, MCP tools are the only channel every client reads.** Prompts are not exposed in ChatGPT, Codex, or VS Code Copilot sessions. SKILL.md is now read by all eight products, but each looks in different folders. AGENTS.md is widely read, but Claude Code ignores it when a CLAUDE.md exists.

## Spec background (revision 2026-07-28)

| Change | What it means for Archidocs | Source |
| - | - | - |
| No `initialize` handshake. Every request carries its version and capabilities in `_meta`. Servers **MUST** implement `server/discover`. | The server is stateless per request. | [changelog #2–3](https://modelcontextprotocol.io/specification/2026-07-28/changelog) |
| Streamable HTTP has no protocol sessions and no `Mcp-Session-Id`. State goes in explicit handles passed as tool arguments. | Archidocs is read-mostly anyway, so it fits. Any cross-call state, such as a chosen Workspace Bundle, goes in tool arguments. | [changelog #1](https://modelcontextprotocol.io/specification/2026-07-28/changelog), [tools: Stateful Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) |
| Sampling, Roots and Logging are **Deprecated**, with earliest removal in the first revision on or after 2027-07-28. Suggested replacements: pass paths as tool parameters or config instead of Roots, call LLM APIs directly instead of Sampling, and log to stderr or OpenTelemetry instead of Logging. | Do not build on any of the three. | [deprecated registry](https://modelcontextprotocol.io/specification/2026-07-28/deprecated), [SEP-2577](https://modelcontextprotocol.io/seps/2577-deprecate-roots-sampling-and-logging) |
| HTTP+SSE transport is Deprecated (since 2025-03-26). | Do not ship SSE. | same |
| Server-to-client requests (elicitation, sampling, roots) became **Multi Round-Trip Requests**: the server returns `resultType: "input_required"` and the client retries. | Elicitation still exists but works differently in the two eras. | [changelog #7](https://modelcontextprotocol.io/specification/2026-07-28/changelog) |
| Structured output: `outputSchema` plus `structuredContent`, now allowed to be any JSON value. A tool returning `structuredContent` **SHOULD** also return the serialized JSON in a text block. | Return both, so clients that ignore `structuredContent` still get the data. | [tools spec](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) |
| Tasks moved to an extension (`io.modelcontextprotocol/tasks`). Extensions are negotiated through `capabilities.extensions`. | Optional extra only. | [changelog #6](https://modelcontextprotocol.io/specification/2026-07-28/changelog), [extensions](https://modelcontextprotocol.io/extensions/overview) |
| Modern-only servers fail against legacy clients: "Legacy clients have no fall-forward mechanism". A **dual-era** server MAY serve both. | Archidocs must be dual-era. | [versioning compatibility matrix](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning) |

The TypeScript SDK v2 (`@modelcontextprotocol/server` 2.4.0, released 2026-10-23) implements 2026-07-28 and serves legacy clients by default. On HTTP, `createMcpHandler` defaults to `legacy: 'stateless'`; on stdio, `serveStdio` defaults to `legacy: 'serve'` ([releases](https://github.com/modelcontextprotocol/typescript-sdk/releases), [legacy-clients guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/legacy-clients.md), [protocol-versions](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/protocol-versions.md)). v1.x receives fixes for at least six months after 2026-07-27.

**About the official clients page:** the old modelcontextprotocol.io feature matrix (`/clients`) was **deleted on 2026-05-27** (commit [`2075a21`](https://github.com/modelcontextprotocol/modelcontextprotocol/commit/2075a21d03)), and the URL now redirects to the intro page. The only official matrix left covers **extensions**: [Extension Support Matrix](https://modelcontextprotocol.io/extensions/client-matrix). For core features, the table below uses each client's own docs first. It falls back to the last version of the deleted page, `clients.mdx` at commit [`87993a6`](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/87993a6816/docs/clients.mdx) dated 2026-05-26, marked **(S)** below. That page was community-maintained, so treat **(S)** entries as weaker evidence.

## Client × feature table

Key: **Y** supported · **N** not supported / stated unsupported · **—** not documented (unconfirmed) · **(S)** only from the 2026-05-26 snapshot · **dep** deprecated in spec.

| Client | stdio | Streamable HTTP | SSE | Tools | Structured output | Resources | Prompts | Server instructions | Elicitation | Sampling (dep) | Roots (dep) | MCP Apps ext | Skills ext | Protocol era |
| - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| **Claude Code** | Y | Y (recommended) | deprecated fallback | Y | — | Y (`@` mentions + list/read tools) | Y (`/server:prompt`) | Y (≤4,096 chars) | Y form + URL, interactive only | — (not in docs or S) | Y | N | N | 2026-07-28 on v2 runtime |
| **Claude Desktop / claude.ai** | Y (Desktop, via `.mcpb` extensions) | Y (from Anthropic cloud) | Y (legacy) | Y | — | Y | Y | — | — | **N** (stated) | Y Desktop (S) | Y | N | legacy (auth follows 2025-11-25) |
| **Cursor** | Y | Y | Y | Y | — | Y | Y | — | Y | N (not listed) | Y | Y | N | — |
| **VS Code / Copilot** | Y | Y | Y (legacy) | Y | — | partial (Apps only; browse in deprecated Local harness) | **N in Copilot sessions** (was Y in S) | Y (S) | Y form + URL, active turn only | Y with approval | Y | Y (experimental, inline) | experimental, off by default | cites 2025-06-18 to 2026-07-28 |
| **ChatGPT** | N (remote only) | Y | Y | Y (read + write) | **Y** (recommends `outputSchema` + `structuredContent`) | N (UI resources only) | N | Y (first 512 chars) | Y (recommended in plugin guide) | — | — | Y | Partial (per matrix) | legacy (auth refs 2025-11-25) |
| **Codex (CLI/IDE)** | Y | Y | — | Y | — | Y (S) | N (S) | Y (first 512 chars) | Y (S) | N (S) | N (S) | — | N | legacy (reads `initialize` instructions) |
| **Windsurf → Devin Desktop** | Y | Y | Y | Y | — | — | — | — | — | — | — | — | — | — |
| **Gemini CLI** | Y | Y (`httpUrl`) | Y (`url`) | Y | — (multi-part content only) | Y (`@server://…`) | Y (slash commands) | Y | — | — | — | — | — | legacy (refs 2025-06-18) |

### Sources and notes by client

- **Claude Code.** [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp):
  - The HTTP transport is "the recommended option" and SSE is deprecated. Automatic SSE fallback needs v2.1.265 or later. There is also a non-standard `ws` transport.
  - Resources: `@server:protocol://path`, with "tools to list and read MCP resources". Prompts: `/servername:promptname (MCP)`.
  - Elicitation: declares `{form:{}, url:{}}` on 2026-07-28 connections and bare `{}` (form only) elsewhere. It is "served only in interactive terminal sessions".
  - Roots: answers with the launch and additional working directories.
  - Server instructions and tool descriptions are cut at 4,096 characters (16,384 for deferred tools). Tool output goes to a file above 50,000 characters. The default `MAX_MCP_OUTPUT_TOKENS` is 25,000 ([claude.com building](https://claude.com/docs/connectors/building)).
  - Runtime: "The v2 runtime is the same code on MCP TypeScript SDK 2.0, which adds MCP protocol revision 2026-07-28". v2 is the default from v2.1.274 in certain sessions.
  - Tasks extension: public beta from v2.1.304.
  - The extension matrix marks Claude Code as Tasks only, with no Apps. Note that the Claude Code docs do mention `_meta.ui.visibility`, which is a contradiction.
- **Claude Desktop / claude.ai.** [claude.com/docs/connectors/building](https://claude.com/docs/connectors/building):
  - Servers can expose "Tools, prompts, and resources" and text, image and binary results.
  - "Claude doesn't yet support … Resource subscriptions, Sampling, Advanced or draft capabilities".
  - Limits on claude.ai and Desktop: about 150,000-character results and a 240-second timeout. Remote connectors connect "from Anthropic's cloud" and must be reachable on port 443 ([custom connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)).
  - Local servers ship as `.mcpb` desktop extensions ([local MCP](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)).
  - The extension matrix marks MCP Apps as Y for both Claude (web) and Desktop, and Tasks as Y for web.
- **Cursor.** [cursor.com/docs/context/mcp](https://cursor.com/docs/context/mcp) lists three transports (stdio, SSE, Streamable HTTP) and six capabilities: Tools, Prompts, Resources, Roots, Elicitation, and Apps. Sampling and instructions are not listed. The page gives no version or date.
- **VS Code / Copilot.** The [extension guide, "MCP support in Copilot"](https://code.visualstudio.com/api/extension-guides/ai/mcp) was updated 2026-11-18:
  - Prompts are "Not exposed as `/mcp.<server>.<prompt>` in Copilot sessions". The guide recommends agent-plugin skills instead.
  - Native servers don't appear in the resource browser.
  - Sampling and Roots are supported but marked "Deprecated in MCP".
  - Elicitation is canceled in Autopilot and declined when no turn is active.
  - MCP Apps are experimental and "`inline` only".
  - The "Local harness is deprecated and will be removed in February 2027" ([config reference](https://code.visualstudio.com/docs/copilot/reference/mcp-configuration)).
  - The May 2026 snapshot listed Prompts and Resources as Y. **This is the clearest example of support being taken away.**
- **ChatGPT.**
  - [OpenAI MCP docs](https://developers.openai.com/api/docs/mcp/): tools; "Declare an output schema for each tool", with `structuredContent` plus a JSON text copy "for compatibility"; `instructions`.
  - [Custom MCP servers in ChatGPT](https://developers.openai.com/api/docs/guides/developer-mode): "SSE and streaming HTTP"; read and write tools; tools without `readOnlyHint` need confirmation.
  - [Plugin MCP server guide](https://developers.openai.com/plugins/build/mcp-server): Streamable HTTP only, plus "Use MCP elicitation when the server needs structured information…".
  - Remote only, so there is no stdio path.
- **Codex.** [learn.chatgpt.com/docs/extend/mcp](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) (redirected from developers.openai.com/codex/mcp): STDIO and Streamable HTTP; Codex "reads the MCP `instructions` field returned during initialization"; config lives in `~/.codex/config.toml` or project `.codex/config.toml`. The current page does not cover resources, prompts or elicitation. The **(S)** entries come from the May 2026 snapshot ("Resources, Tools, Elicitation, Instructions").
- **Windsurf.** `docs.windsurf.com/windsurf/cascade/mcp` now **redirects to [docs.devin.ai/desktop/cascade/mcp](https://docs.devin.ai/desktop/cascade/mcp)**, which documents "Devin Local" in **Devin Desktop**. It supports "`stdio`, `Streamable HTTP`, and `SSE` transports, and OAuth for each". Config lives in `.devin/mcp_config.json`, and legacy `.windsurf/` paths still load. The page names no other features. The May 2026 snapshot listed only "Tools, Discovery". I could not find an official statement that Windsurf was renamed; the redirect is the only evidence.
- **Gemini CLI.** [geminicli.com/docs/tools/mcp-server](https://geminicli.com/docs/tools/mcp-server/), last updated 2026-10-06:
  - Supports stdio (`command`), SSE (`url`) and Streamable HTTP (`httpUrl`).
  - Resources via `@`, prompts as slash commands, and "supports MCP server instructions".
  - The page refers to spec 2025-06-18.
  - Gemini CLI "was replaced by Antigravity CLI" for unpaid-tier and Google One users on 2026-06-18. I did not research Antigravity CLI.

### Extension support ([official matrix](https://modelcontextprotocol.io/extensions/client-matrix), read 2026-11-21)

MCP Apps (`io.modelcontextprotocol/ui`) is supported by Claude web and Desktop, VS Code, ChatGPT and Cursor, but not Claude Code. **Skills over MCP** (`io.modelcontextprotocol/skills`) shows only ChatGPT as Partial among our eight clients. I could not confirm the ChatGPT entry: the matrix links to `developers.openai.com/plugins/build/mcp-server#import-skills-from-the-mcp-server`, but that page had no such section on 2026-11-21. VS Code's own docs describe experimental MCP-served skills behind `chat.agentHost.mcpSkills.enabled`, which is off by default ([VS Code agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills)). The matrix marks Tasks as supported by Claude web and Claude Code.

## Delivering authoring guidance

| Channel | Spec | Who reads it (our 8) | Caveats |
| - | - | - | - |
| **MCP tool**, such as a `get_authoring_guide` tool, plus well-written tool descriptions | core MCP | **All 8** | Description length caps: Claude Code cuts at 4,096 chars. The model has to choose to call the tool, so name and describe it clearly. |
| **MCP server `instructions`** | core MCP | Claude Code, Codex, ChatGPT, Gemini CLI, VS Code (S). Unconfirmed for Cursor, Devin and Claude apps. | OpenAI says to keep "the first 512 characters self-contained"; Claude Code cuts at 4,096. Good as a short pointer to the guide tool. |
| **MCP prompts** | core MCP | Claude Code, Claude apps, Cursor, Gemini CLI | **Not** ChatGPT, Codex or VS Code Copilot sessions. User-invoked only, so the model never pulls them in on its own. |
| **MCP resources** | core MCP | Claude Code, Claude apps, Cursor, Gemini CLI, Codex (S) | Not ChatGPT (non-UI) or VS Code native. Usually user-attached rather than model-pulled. |
| **Skills over MCP extension** (`skills/list`, `skills/get`, `skill://` resources) | [SEP-2640, Final](https://modelcontextprotocol.io/extensions/skills/overview) | ChatGPT Partial (unverified); VS Code experimental and off by default | Too early to depend on. Very cheap to add later because it reuses the same SKILL.md files. |
| **SKILL.md** ([Agent Skills spec](https://agentskills.io/specification)) | agentskills.io | **All 8 products** read SKILL.md (see paths below). The [showcase data](https://github.com/agentskills/agentskills/blob/main/docs/snippets/clients.jsx), updated 2026-08-09, lists Claude Code, Claude, Cursor, VS Code, GitHub Copilot, Gemini CLI, and "ChatGPT & Codex". Devin Desktop documents it too. | Discovery folders differ. Use only the six portable frontmatter fields (`name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools`). Claude Code says other fields fail outside Claude Code ([skills](https://code.claude.com/docs/en/skills)). |
| **AGENTS.md** ([agents.md](https://agents.md/)) | plain Markdown, no required fields; "closest AGENTS.md to the edited file wins"; stewarded by the Agentic AI Foundation (Linux Foundation) | Codex, Cursor, VS Code, Devin/Windsurf, Gemini CLI (via `context.fileName`), Claude Code (v2.1.277+) | Claude Code reads it **only when no CLAUDE.md** exists in the working directory or above ([memory](https://code.claude.com/docs/en/memory)). Gemini CLI needs `"fileName": ["AGENTS.md", …]` ([GEMINI.md docs](https://geminicli.com/docs/cli/gemini-md/)). Loaded into every session, so keep it short. |

SKILL.md discovery folders:

| Folder | Read by |
| - | - |
| `.agents/skills/` | Cursor, Codex, Gemini CLI, Devin Desktop, VS Code (Codex harness, and the deprecated Local harness) |
| `.claude/skills/` | Claude Code, Cursor, VS Code (Claude harness), Devin (when the option is on) |
| `.github/skills/` | VS Code Copilot harness |

Sources: [Cursor skills](https://cursor.com/docs/context/skills), [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Gemini CLI skills](https://geminicli.com/docs/cli/skills/), [VS Code agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills), [Claude Code skills](https://code.claude.com/docs/en/skills), and Devin Desktop docs via [docs.devin.ai customizations](https://docs.devin.ai/desktop/devin-local/customizations). The Claude Code skills page does **not** list `.agents/skills/`. The Claude apps (claude.ai and Desktop) take uploaded or synced skills rather than repo folders.

## Could not confirm

- **Structured output** (`outputSchema` / `structuredContent`): only OpenAI documents it explicitly. No other client's docs say whether the model sees `structuredContent`, the text copy, or both. This is why the server should always send the text copy.
- **Protocol era by client:** only Claude Code (v2 runtime) clearly speaks 2026-07-28. VS Code cites all revisions without saying which it negotiates. For the others, the era is inferred from the spec versions their docs cite.
- **Windsurf / Devin Desktop** beyond tools and transports: the current docs say nothing, and the old snapshot (May 2026) listed only Tools and Discovery.
- **Cursor and Devin server `instructions`**, and **Claude apps elicitation and instructions**: not documented.
- **ChatGPT "Partial" Skills-over-MCP support:** the linked section was missing on 2026-11-21.
- **Gemini CLI** elicitation, sampling and roots: not mentioned. Antigravity CLI, which replaced it for some users, was not researched.
- **Codex** resources and elicitation rest only on the May 2026 snapshot; the current Codex page doesn't mention them.

## Recommendation

**Rely on these (works in all 8 clients):**
- **Tools** are the whole contract. Every persona question and every authoring action is a tool. Follow the spec's naming rules (≤128 chars, `[A-Za-z0-9_.-]`), give a deterministic `tools/list` order, and set accurate `readOnlyHint` / `destructiveHint` annotations. ChatGPT and Codex use the annotations to decide when to ask for confirmation.
- **Results** carry both `structuredContent` with an `outputSchema` **and** the same data in a text block, per the spec's backward-compatibility SHOULD. Keep each result under about 25k tokens (the Claude Code default) and well under 150k characters (the Claude apps limit). Use paging or explicit handles for large Views.
- **Stateless design**: no reliance on sessions. Pass the Workspace, Bundle or checkout path as tool arguments or server config, never through Roots.

**Optional (progressive enhancement; nothing essential depends on them):**
- **Server `instructions`**: a short pointer to the guide tool, self-contained within 512 chars and under 4,096.
- **Resources**: Model files, ADRs and Views exposed as resources for clients that support `@`-attachment. Every resource must also be reachable through a tool.
- **Prompts**: shortcut entry points, for example "draft an ADR" or "explain upstream of X". They mirror tools and add nothing new.
- **Elicitation**: only for confirming a write, such as "open PR with status Proposed?". The tool must still work when the client doesn't support elicitation or declines.
- **MCP Apps**: a possible later in-chat View renderer for Claude apps, ChatGPT, Cursor and VS Code. Not Claude Code. Not in v1.
- **Skills over MCP extension**: add once host support exists, reusing the same SKILL.md files.
- **Avoid entirely:** Sampling, Roots and Logging (deprecated 2026-07-28), and the SSE transport.

**Transport plan:**
1. **stdio** is the primary way to run the server against a local checkout or a downloaded Workspace Bundle. Seven of the eight clients support it; Claude Desktop needs a `.mcpb` package. ChatGPT has no stdio path.
2. **Streamable HTTP** comes from the same server (`archidocs mcp --http`) for a bundle URL, CI, or team hosting. ChatGPT and claude.ai web connect from their own clouds, so they need a public HTTPS endpoint. That belongs to the open "Hosted remote MCP" item and is out of v1 scope.
3. **Dual-era**: build on TypeScript SDK v2 (`@modelcontextprotocol/server` ≥ 2.4.0) and keep the defaults (`legacy: 'serve'` on stdio, `legacy: 'stateless'` on HTTP). Most clients today still open with `initialize`, and a modern-only server would fail against them.
4. **No SSE.**

**Portable authoring guidance:**
1. **The source of truth is one skill folder**, `archidocs-authoring/SKILL.md` plus `references/`, using only the six spec frontmatter fields.
2. **Serve it through tools** so every client can read it. A `get_authoring_guide` tool, with an optional topic argument, returns the SKILL.md body or a reference file. The server `instructions` tell the model to call that tool before editing Model files. This is the only channel all eight clients share, and it keeps the map's "everything essential is a tool" rule.
3. **Convenience wrappers** come from the same folder through `archidocs init`:
   - Write the skill to `.agents/skills/archidocs-authoring/`, which covers Cursor, Codex, Gemini CLI, Devin, and VS Code's Codex and Local harnesses.
   - Mirror or symlink it into `.claude/skills/` for Claude Code and VS Code's Claude harness, and into `.github/skills/` for VS Code Copilot.
   - Add a 3–5 line AGENTS.md snippet saying "Archidocs Model lives in …; call the `archidocs` MCP tool `get_authoring_guide` first". If the repo already has a CLAUDE.md, the same line goes there too, because Claude Code skips AGENTS.md in that case.
4. **Do not use MCP prompts as the delivery channel.** They are missing in ChatGPT, Codex and VS Code Copilot, and they are user-invoked only.
