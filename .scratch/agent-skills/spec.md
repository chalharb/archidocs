# Agent skills

Status: open

Four agent skills instead of one, a single way to load any of them, a real command for the gap scan, and a Claude Code plugin that ships them under the `archidocs:` prefix. Settled in a grilling session on 2026-11-26. Terms follow [GLOSSARY.md](../../GLOSSARY.md).

This reopens [Authoring skill](../archidocs-v1/issues/12-authoring-skill.md), which decided on one skill and gave reading flows no topic ("the read tools describe themselves").

## Problem Statement

Archidocs ships one skill, `archidocs-authoring` ([guide/SKILL.md](../../guide/SKILL.md)), and it fires only when an agent sets out to edit the Model.

- **Nothing fires while an agent edits code.** An agent changing an API in a Service repo never thinks to ask who depends on it. The read tools (`search_elements`, `get_impact`, `find_paths`, `get_deployments`, `list_owned`, `list_adrs`) can answer that, but only when called in order, and a tool's own description can't teach the order or say when to start.
- **Nothing keeps the Model in step with the code.** When a change adds a call to another Service, a datastore or a broker, nothing prompts the agent to add the Relationship.
- **Filling gaps is buried in authoring.** `fill-gaps` is a long interview the user starts ("what's missing?"), unlike the single-edit topics around it. The authoring description carries its trigger too, which blurs both.
- **The gap scan is a 40-line jq script.** Step 2 of `fill-gaps` builds the Bundle to a temp folder and runs jq over it; over MCP alone the agent walks `list_owned` × `get_element` by hand.
- **Nothing starts from an explanation.** `bootstrap` needs code and `fill-gaps` needs a Model. A user who wants to talk their architecture through ("a Next.js app with a BFF calls an API on Anthos through Apigee…") has no skill to turn that into a Model.
- **Gateways have no modelling rule.** Neither the glossary, the ADRs nor the guide say how an API gateway or proxy is modelled.
- **No namespaced install.** In Claude Code, skills shipped as a plugin show as `plugin:skill`; Archidocs has no plugin.

## Solution

| Skill | Fires when | Reads | Writes |
| --- | --- | --- | --- |
| `authoring` | the agent sets out to edit the Model | Model | yes |
| `consult` | the agent changes code: a contract, a dependency, a Service's name or life, deployment config; or answers who calls, owns or deploys something | Model | never; hands off to `authoring` |
| `fill-gaps` | the user asks what's missing, or to audit or complete the Model | Model, code | yes, following `authoring` |
| `describe` | the user explains their architecture in prose | the user's words | yes, following `authoring` |

- **One guide tool.** `get_guide(skill, topic?)` over MCP and `archidocs guide [topic] --skill <name>` serve any skill's text from the running version. `get_authoring_guide` stays as a deprecated alias.
- **A gap command.** `list_gaps` over MCP and `archidocs gaps` in the CLI replace the jq script.
- **Stubs in repos.** `init` and `init --skill` write a thin stub per skill, named `archidocs-<skill>`.
- **A Claude Code plugin** named `archidocs`, with skills `authoring`, `consult`, `fill-gaps` and `describe` (so `archidocs:consult`), shipping the same stubs and the MCP server.
- **A gateway ADR** settles how gateways and proxies are modelled.

## Implementation Decisions

### Skills and their guides

- Each skill has a stub (frontmatter `name` and `description`, then "load the guide") and a full guide served by the running `archidocs`, as ticket 12 settled for authoring. A stub never goes stale, because the guide text always matches the schema of the version serving it.
- Skill ids are `authoring`, `consult`, `fill-gaps`, `describe`. Stubs `init` writes are named `archidocs-<id>`, because `.agents/skills/` has no namespace. In the plugin the folder is `<id>`, shown as `archidocs:<id>`.
- Guides live in `guide/`: `guide/SKILL.md` and `guide/topics/` stay authoring's; each new skill gets `guide/<id>/SKILL.md`. Only authoring has topics.
- `consult`, `fill-gaps` and `describe` don't repeat the Model rules or the edit loop. A guide that writes, or hands off to writing, opens with "load `authoring` first (`get_guide("authoring")`)".

### Descriptions

- **authoring**: drop "or finding and filling documentation gaps": *Edit the Archidocs architecture Model. Use when bootstrapping a Project from code, adding or changing Services, Relationships, Deployments or Views, or proposing an ADR.*
- **consult**: *Check the Archidocs architecture Model before and after changing code. Use when changing a public API, event or schema, adding or removing a dependency on another Service, datastore or broker, renaming or retiring a Service, changing deployment config, or answering who calls, owns or deploys something.*
- **fill-gaps**: *Find and fill what the Archidocs Model leaves empty, by interviewing the user with values proposed from evidence in the code. Use when asked what's missing or undocumented in the architecture, to audit or complete the Model, or to prepare a Team's documentation backlog.*
- **describe**: *Build the Archidocs Model from the user's own explanation of their architecture, iteratively, with no code needed. Use when the user describes how their systems fit together in prose, wants to talk through or sketch an architecture, or is documenting something whose code isn't available.*

### `get_guide`

- MCP: `get_guide(skill, topic?)`. `skill` is one of the four ids. With no topic, the skill's SKILL.md (for authoring, followed by its topic list, as today); with a topic, that topic. A topic on a skill without topics is refused with the skill's name.
- CLI: `archidocs guide [topic] [--skill <id>]`, `--skill` defaulting to `authoring`, so `archidocs guide add-service` is unchanged.
- `get_authoring_guide(topic?)` stays, described as deprecated in favour of `get_guide`, and returns the same as `get_guide("authoring", topic)`. 1.3.x stubs call it.
- `get_authoring_guide("fill-gaps")` and `archidocs guide fill-gaps` return a short note: the topic moved to the `archidocs-fill-gaps` skill, load it with `get_guide("fill-gaps")`. `fill-gaps` leaves authoring's topic list. Drop the note at the next major version.

### `list_gaps` and `archidocs gaps`

- The gap rules are the table under "What counts as a gap" in today's `guide/topics/fill-gaps.md`, ported to TypeScript in core and tested against that table. Gap names: `description`, `technology`, `repository`, `deployments`, `api-docs`, `channel`, `url`.
- MCP: `list_gaps(project?, owner?)` returns `[{project, owner, item: {kind: "element" | "relationship" | "deployment", id}, missing: [gap]}]`.
- CLI: `archidocs gaps [--project <id>] [--owner <team>] [--json]` prints the Markdown the jq script prints today (`##` Project, `###` Owner Team, one line per item); `--json` prints the MCP shape. It exits 0 whether or not there are gaps; exit 1 only when the Workspace has check errors, as `build` does.
- Gaps are computed from the Model on every call and never stored. `skip` and `unknown` answers in the interview are not recorded; the open list lives in the session's summary and PR body.
- Gaps stay out of `check`: `check` is about validity, a gap is incompleteness. A `--fail-on` for CI is left for later.

### `consult`

- **Before the change**: `search_elements` to resolve the Service; `get_impact(direction: "upstream", max_depth: 1)` for the consumers named, and once without `max_depth` for a "+N indirect" count; the Owners of the Element and its consumers; `get_deployments`; `list_adrs` for the Element, `get_adr` for any that look relevant.
- **Report** before editing, four lines: consumers, Teams to tell, Deployments, ADRs.
- **Stop and ask** only when an Accepted ADR contradicts the change, or the change breaks a contract another Team's consumer uses. Otherwise carry on; never block on judgement alone.
- **After the change**: compare only the dependencies this change touched against the Element's Relationships. On a difference, hand off to authoring's `relationships` or `add-service` topic. Drift seen beyond the change gets one line pointing at `fill-gaps`.
- **Not in the Model**: when `search_elements` finds nothing, say so in one line, carry on with the code change, and afterwards offer authoring's `add-service` (or `bootstrap` if the Project is missing too).
- **Answering**: a table from question to tool: who calls → `get_impact` upstream; what it calls → `get_impact` downstream; how A reaches B → `find_paths`; who owns → `list_owned` or the Element's `owner`; where it runs → `get_deployments`; what changed → `get_changes` / `list_history`; why → `list_adrs` / `get_adr`.
- **No MCP server**: read the Workspace YAML directly; consumers are found by grepping `to:` references for the Element's id and its `project:id`. The guide gives the exact search. CLI read commands are a separate feature.

### `fill-gaps`

- The current `guide/topics/fill-gaps.md` moves to `guide/fill-gaps/SKILL.md`, with:
  - an opening that loads authoring first;
  - step 2 (Gap scan) calling `list_gaps` or `archidocs gaps` instead of building a Bundle and running jq;
  - the "Gap query" section deleted, and "What counts as a gap" kept as the reader's explanation of what `list_gaps` reports.
- The interview, Evidence, Writing, Metadata, Decisions and Summary sections move unchanged.

### `describe`

- **Input** is only what the user says. It never reads code; when the Model is written it offers `fill-gaps`, which pulls `technology`, `repository`, URLs and the rest from code.
- **Rounds**: the user explains part of the system; the agent maps it to Elements, Relationships, Deployment Targets and Deployments, then plays back the whole draft as an outline plus a one-line-per-path text flow (`web → api → bigquery ← etl ← source`), and asks only the ambiguities as numbered questions, each with a proposed answer, worded so "yes" accepts it. The full draft is played back every round, not only the delta.
- **First round** also asks the Project and its Owner Team once, defaulting to one new Project. Later prose that clearly describes another Team's System is proposed as its own Project, linked with `project:id`; "keep it all in one" is accepted.
- **Writing**: nothing is written until the user approves the first draft. Then authoring's `bootstrap`-style writes go through, and each later round writes its changes. After the first write the agent starts `archidocs dev` in the background if the harness can and gives the URL, else prints the command; it never blocks on the viewer.
- **What it writes**: what was said: `technology`, `type`, `external`, the `description` in the user's words, a Deployment Target per platform named (`kind: anthos`). It never invents Environments, URLs or Owners. A named platform triggers one question: "which Environments does this run in?". Anything unsaid stays a gap.
- **Black boxes**: always ask whether it's run by a vendor (System, `external: true`) or inside the organization (System with no Components, owned by the Team that runs it, asked or left as a gap). The user's words go in `description`.
- **Gateways** follow the ADR from ticket 07.
- **Worked example** in the guide: the Next.js / BFF / Anthos / Apigee / BigQuery / ETL / black-box prose from the grilling, with its draft and the questions it raises.

### Gateways and proxies

- ADR `docs/adr/0005-…`: an API gateway or reverse proxy is a Service (`technology: Apigee`) in the path by default: `web → apigee → api`, owned by the Team that runs it. The documented lighter option, for shared infrastructure nobody needs to see, is to leave it out and name it in the Relationship's `technology` (`HTTPS via Apigee`). The gateway's URL is the consumer-facing Deployment `url`.
- A sync `via` (like the async broker `via`) was considered and left as its own feature.
- Authoring's `relationships` topic gets a "Gateways and proxies" section; GLOSSARY.md gets no new term (a gateway is a Service).

### `init`

- `init` and `init --skill` write all four stubs into `.agents/skills/`, `.claude/skills/` and `.github/skills/`, and one AGENTS.md (and CLAUDE.md if present) pointer line per skill.
- `init --no-claude-skills` skips `.claude/skills/`, for teams that standardise on the plugin.
- The repo's stubs are the team's source of truth; the plugin is for personal use in repos that never ran `init`. The install page says to pick one per repo.

### Claude Code plugin

- `.claude-plugin/plugin.json` (name `archidocs`) and `.claude-plugin/marketplace.json` at the repo root, so users run `/plugin marketplace add chalharb/archidocs` then `/plugin install archidocs@archidocs`.
- `plugin/skills/<id>/SKILL.md` holds the same stubs `init` writes, with the plugin's runner. They are generated from `skillStub` by a script, and a test fails when they drift.
- `plugin/.mcp.json` registers `npx archidocs mcp --workspace ${ARCHIDOCS_WORKSPACE:-.}`. Verify that Claude Code expands `${VAR:-default}` in a plugin's `.mcp.json`; if it doesn't, use `${ARCHIDOCS_WORKSPACE}` and document setting it.
- semantic-release writes the version into `plugin.json` and `marketplace.json` alongside `package.json`.

### Decisions taken here

Settled while writing this spec, outside the grilling; challenge before the tickets start.

- **Two MCP servers in one repo.** [ADR 0002](../../docs/adr/0002-init-registers-the-mcp-server.md) already has `init` write `archidocs` into the repo's `.mcp.json`. With the plugin installed too, Claude Code runs both servers (the plugin's is namespaced, so they don't clash by name, but every tool appears twice). This follows the same rule as the skills: pick one per repo, and the install page says so. `--no-claude-skills` doesn't remove the `.mcp.json` entry, because other harnesses read that file.
- **Guides folder layout** (`guide/<id>/SKILL.md`) is picked here; the grilling didn't settle it.

## Testing Decisions

- **Stubs**: each skill's stub content, with and without a custom runner (extends `test/cli/init.test.ts`).
- **init**: `init` and `init --skill` write four stubs per skill folder; `--no-claude-skills` skips `.claude/skills/`; re-running is idempotent.
- **get_guide**: each skill and topic over MCP and CLI; unknown skill and topic suggestions; `get_authoring_guide` equals `get_guide("authoring")`; the moved-topic note (extends `test/mcp/guide.test.ts`, `test/cli/guide.test.ts`).
- **Guides name real tools**: every backticked `snake_case` tool name in `guide/**` is registered on the MCP server.
- **list_gaps**: one case per row of the gap table, filters, the Markdown and JSON output, exit codes.
- **Plugin**: the generated stubs match `skillStub`; `plugin.json` and `marketplace.json` versions match `package.json`.
- No model-in-the-loop evals.

## Out of Scope

- CLI read commands (`archidocs impact` and the like) for agents without MCP.
- A sync `via` for gateways.
- `archidocs gaps --fail-on` for CI.
- Detecting the plugin from `init`.

## Tickets

| # | Ticket | Blocked by |
| --- | --- | --- |
| 01 | [`get_guide` and `--skill`](issues/01-get-guide.md) | none |
| 02 | [`list_gaps` and `archidocs gaps`](issues/02-list-gaps.md) | none |
| 03 | [`fill-gaps` skill](issues/03-fill-gaps-skill.md) | 01, 02 |
| 04 | [`consult` skill](issues/04-consult-skill.md) | 01 |
| 05 | [`init` writes every stub](issues/05-init-stubs.md) | 03, 04, 08 |
| 06 | [Claude Code plugin](issues/06-claude-code-plugin.md) | 05 |
| 07 | [Gateways and proxies ADR](issues/07-gateway-adr.md) | none |
| 08 | [`describe` skill](issues/08-describe-skill.md) | 01, 07 |
