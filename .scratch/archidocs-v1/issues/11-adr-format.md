# ADR format and linking

Type: grilling
Status: resolved
Assignee: Logan Harber
Blocked by: 05
Map: [Archidocs v1](../map.md)

Context: [MCP tool surface](08-mcp-tool-surface.md) fixes the tools `list_adrs(element?, status?)`, `get_adr(id)` and `propose_adr(project, title, elements, body)`; this ticket settles the fields they carry. [View kinds and definitions](10-view-definitions.md) refuses `remove_view` while an ADR links to a View; this ticket decides whether ADRs link Views and in which field. [archidocs check](16-archidocs-check.md) sets the rule scheme (kebab-case ids, error or warning, `{file, line, column?, rule, severity, message}` records); this ticket adds the ADR rules under it.

## Question

What does an ADR file look like? Settle frontmatter (linked Element ids, status lifecycle, supersedes), numbering (per Project or per Workspace), where ADRs that span Projects live, and how the ADR timeline for an Element is put together.

## Answer

Settled in a grilling session on 2026-11-22. Terms follow [GLOSSARY.md](../../../GLOSSARY.md), which this session updated (ADR).

**Files and ids**
- **Location:** an `adr/` folder directly inside the Project folder, such as `archidocs/payments/adr/0003-use-kafka.md`. Every `.md` file there is an ADR, except `template.md`.
- **Numbering:** per Project. Files are named `NNNN-slug.md`, and the qualified id is `project:NNNN` (for example `payments:0003`). ADR ids form their own namespace, separate from Elements and Views. The slug is for humans and is not part of the id.
- **Number clashes:** two open PRs that take the same number fail `check` as a duplicate. `propose_adr` takes the next free number in the checkout.
- **ADRs spanning Projects** live in the Project that owns the decision, such as an `architecture` Project the org chooses, the same rule as Workspace-wide Saved Views. Links name Elements in other Projects as `project:id`. `workspace.yaml` stays limited to Teams and Environments.

**File shape**
- **Title:** the body's first `# ` heading. It is not a frontmatter field.
- **Frontmatter**, with field names following MADR v4:
  - **Required:** `status` and `date` (ISO date of the last status change).
  - **Optional:** `decision-makers`, `consulted`, `informed` (free strings, people or Team ids, not checked), `tags`, `elements`, `views` and `supersedes`.
  - **No Owner field:** an ADR belongs to its Project, as a View does.
- **Body:** free-form markdown; no sections are enforced. An existing MADR file can move in by adding only its links.

**Status lifecycle**
- **Values:** `proposed`, `accepted`, `rejected`, `deprecated` and `superseded`. Deprecated means "no longer applies, nothing replaced it".
- **Proposed** lives on PR branches. Accepting means the PR sets `status: accepted` and the date before it merges. Rejecting means closing the PR; `rejected` only appears where a team chooses to keep the record. Proposed ADRs show up in MCP and the viewer when they run against that branch.
- `check` can't see branches, so a merged `proposed` ADR is valid, just unusual.

**Links**
- `elements: [ids]` lists Elements and Deployment Targets, which share an id namespace. A bare id means the ADR's own Project.
- `views: [ids]` lists Saved Views only. Generated Views can't be linked; linking their scope Element covers them.
- **Not in v1:** links to Relationships.
- **No links required:** both lists are optional, for Workspace-wide decisions such as "every Service emits OpenTelemetry", and there is no warning.
- **Removal:** `remove_view` is refused while an ADR lists the View, and `remove_element` and `remove_target` while an ADR lists the item, under the existing "refused while referenced" rule.

**Supersedes**
- **Declared once:** the new ADR declares `supersedes: [ids]`, qualified across Projects. The old file is not edited.
- **Derived:** once the new ADR is `accepted`, the Bundle, MCP and viewer derive `supersededBy`, and show the old ADR's effective status as `superseded`.
- **Never hand-written:** writing `status: superseded` by hand is a `check` error.
- **Trade-off:** someone reading the old file raw on GitHub still sees `accepted`.

**Templates**
- **Default:** `propose_adr` writes MADR minimal (Context and Problem Statement, Considered Options, Decision Outcome, Consequences).
- **Overrides:**
  - `adr-template.md` beside `workspace.yaml` overrides the default for the Workspace.
  - `<project>/adr/template.md` overrides the Workspace template for one Project.
- **Placeholders:** a template is markdown with frontmatter. `propose_adr` fills `{{title}}`, `{{date}}`, `{{elements}}` and `{{views}}`, and forces `status: proposed`.
- **No validation:** `check` skips templates and never checks an ADR's sections against one.

**Timeline for an Element**
- `list_adrs(element)` returns the ADRs that link the Element directly or link any of its descendants. Each result carries `matchedVia`.
- **Not ancestors:** ADRs that link only ancestors are left out, so System-level ADRs don't flood every Service.
- **Order:** newest first by `date`, then by number.
- **Superseded ADRs** are included and marked.
- **Not decided here:** when an ADR's file changed in git is left to [History UX](15-history-ux.md).

**Bundle**
- The `adrs` slot holds each ADR with:
  - its qualified id, title, `status`, effective status and `date`;
  - its links (qualified), `supersedes` and `supersededBy`;
  - `decision-makers`, `consulted`, `informed` and `tags`;
  - the full markdown body and `source: {file, line}`.
- Templates are not included.

**MCP**
- **`list_adrs(element?, status?, tag?)`:**
  - **Returns:** a summary per ADR (id, title, status, effective status, date, links, `matchedVia`).
  - `status` filters on effective status.
  - It takes `limit` and the reserved `at`, as other read tools do.
- **`get_adr(id)`:** everything in the Bundle slot.
- **`propose_adr(project, title, elements?, views?, supersedes?, body?)`:**
  - **Signature change:** `elements` is now optional, changing [MCP tool surface](08-mcp-tool-surface.md).
  - With no `body`, the template is filled.
  - It takes the next free number, and checks links and `supersedes` against the Workspace like other writes.
  - It takes `dry_run`.
- **`get_element`:** its `adrs` list matches `list_adrs(element)`.
- **No other ADR write tools in v1:**
  - Accepting, rejecting or deprecating an ADR is a status and date edit in the PR, made by a human or by an agent with its own file tools, then `check`.
  - The status change is the act of review, so it belongs in the PR.

**`check`**
- Rule ids are left to [archidocs check](16-archidocs-check.md).
- **Errors:**
  - bad frontmatter, or a `status` outside the list
  - a missing `# ` title
  - a filename that isn't `NNNN-slug.md`
  - a duplicate number within a Project
  - unknown ids in `elements`, `views` or `supersedes`
  - a hand-written `superseded` status
  - a cycle in `supersedes`
- **Warnings:**
  - an ADR superseded by more than one accepted ADR
  - an ADR that supersedes one that isn't `accepted` or `deprecated`
