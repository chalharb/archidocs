# Authoring skill

Type: grilling
Status: resolved
Assignee: Logan Harber
Blocked by: 03, 06, 08
Map: [Archidocs v1](../map.md)
Context: [View kinds and definitions](10-view-definitions.md) settles the YAML for Saved Views and Dynamic View Steps, and adds `upsert_view`/`remove_view` write tools. [ADR format and linking](11-adr-format.md) settles the propose flow: `propose_adr(project, title, elements?, views?, supersedes?, body?)` fills a Project or Workspace template (MADR minimal by default) when no body is given; accepting is a status edit in the PR. [archidocs check](16-archidocs-check.md) fixes the rule ids and their catalogue, served through `get_authoring_guide`; write tools refuse on errors, never warnings.

## Question

What does the authoring skill do, and how is it packaged? Settle: bootstrapping a Project's Model by reading its code (Services, Relationships, Deployments from config), the guided flows (add a Service, add a Dynamic View, propose an ADR), how it uses the MCP write tools, and how it ships in a harness-agnostic way.

## Answer

Settled in a grilling session on 2026-11-22. Terms follow [GLOSSARY.md](../../../GLOSSARY.md); this session corrected its intro (the Workspace is one repo). Builds on [MCP client support](03-mcp-client-support.md) (a `get_authoring_guide` tool plus a portable SKILL.md) and on the write tools from [MCP tool surface](08-mcp-tool-surface.md) and [View kinds and definitions](10-view-definitions.md).

**Packaging**
- **One skill,** `archidocs-authoring`. `SKILL.md` holds the shared rules: Model kinds, ids, the edit loop, and what never to do. Each flow is a reference file, picked by topic.
- **Served by the tool:** `get_authoring_guide(topic?)` returns `SKILL.md` and the list of topics, or one topic's reference file. The CLI fallback `archidocs guide [topic]` prints the same text when no MCP server is connected. The guide always matches the schema of the version that serves it.
- **Thin stub in repos:** the copy `archidocs init` writes is a stub that never goes stale. It has the trigger description (editing the Archidocs Model) and says "call `get_authoring_guide`, or run `archidocs guide` without MCP". It uses only the portable frontmatter fields.
- **Install:**
  - `archidocs init` in the Workspace repo, and `archidocs init --skill` in a code repo, write the stub to `.agents/skills/`, `.claude/skills/` and `.github/skills/`. They also add a short pointer to AGENTS.md, and to CLAUDE.md if one exists.
  - They **print** the MCP command to register (`archidocs mcp --workspace <path>`), and write no harness-specific config file.

**Where the agent runs**
- The skill needs two things: code it can read and a writable Workspace checkout. It works in either repo, or in a monorepo where they are the same folder.
- The documented default is the agent running in the Service's code repo, with `archidocs mcp --workspace <path>` pointing at a local Workspace checkout. This adds the `--workspace` flag to `archidocs mcp`.

**Edit loop (every flow)**
- **Writes:** edits go through the MCP write tools only. Direct YAML edits followed by `archidocs check` are the fallback only when no MCP server is connected.
- **Refused writes:** the agent reads `issues` and fixes the input, or asks the user. It never works around a refusal with file edits.
- **Single-change flows:** write, then show the user the returned diff.
- **Bootstrap:** one approval at the inventory step, then the writes go through without a `dry_run` on each one.
- **Finish:** every flow ends with `check`. The agent never commits, and suggests a branch name and a PR title and body.

**Topics (v1)**
- `bootstrap`, `add-service` (a Service with its Components, Relationships and Deployments), `relationships` (including async `via`/`channel`), `deployments` (Deployments, Deployment Targets, URLs), `dynamic-view`, `saved-view`, `propose-adr`, and `change` (rename, move or remove, working through refused removals by their references).
- Reading and answering persona questions get no topic; the read tools describe themselves.

**Bootstrap**
- **Guidance only:** the skill tells the agent what to look for (Dockerfiles, compose, Kubernetes and Helm, Terraform, CI deploy steps, env and config files for URLs, HTTP clients, OpenAPI, broker topics). The agent reads them with its own tools. Archidocs ships no parsers, and bootstrap runs once: there is no re-sync and no detection of code changes. Importers and drift detection stay out of scope.
- **Steps:**
  1. Confirm the Project id, name and Owner Team.
  2. Build an inventory of candidate Services, Components, outbound Relationships, Deployment Targets and Deployments with URLs. Each entry carries its evidence (file:line) and a confidence.
  3. Ask only what code can't tell: the System grouping, External flags, business descriptions, and Owners other than the Project's.
  4. The user confirms or edits the inventory.
  5. Write, run `check`, and report what was written and skipped, with the evidence, ready for the PR description.
- **Evidence stays out of the Model;** nothing is tagged `inferred`.
- **New write tool:** `create_project(id, name, owner, folder?)` writes `project.yaml` and follows the usual write rules. It refuses duplicate ids and nesting inside another Project. The default folder is `<workspace-root>/<id>/`.
- **Cross-Project Relationships:**
  - **Outbound only:** Relationships sit under their consumer, so the skill declares only this Project's outbound ones.
  - **Resolving providers:** a provider is resolved with `search_elements` (by name, URL or host) to its `project:id`.
  - **No match:** the Relationship is left out and listed in the report as a gap. The skill never creates Elements in another Project.
  - **Outside the organisation:** a provider clearly outside the organisation (such as a payment provider) may be declared as an External in this Project, owned by this Team.

**Dynamic View**
- The user describes a scenario or names an entry point. The agent traces the path through the Model, and through code where needed, and drafts Steps (`from`/`to`, return Steps).
- When a Step has no Relationship, the agent proposes adding it with `upsert_relationship` (with the user's OK) rather than dropping the Step. It then calls `upsert_view`.

**Propose an ADR**
1. Gather the decision, its options and the affected Elements, resolved with `search_elements`. The agent may use the trade-offs found in the conversation.
2. Draft the body from the template fixed by [ADR format and linking](11-adr-format.md).
3. Call `propose_adr`.
4. Hand the PR to the person or harness.

The topic follows whatever that ticket decides.

**New surface added here**
- The `create_project` write tool.
- The `--workspace <path>` flag on `archidocs mcp`.
- The CLI commands `archidocs guide [topic]` and `archidocs init --skill`.
