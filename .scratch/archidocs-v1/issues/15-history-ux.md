# History UX

Type: grilling
Status: resolved
Assignee: Logan Harber
Blocked by: 07, 14
Map: [Archidocs v1](../map.md)

Context: [MCP tool surface](08-mcp-tool-surface.md) reserves an `at` (commit) argument on read tools for this ticket. [View kinds and definitions](10-view-definitions.md) keeps Saved View definitions (not resolved results) in the Bundle, so View changes can be diffed too. [ADR format and linking](11-adr-format.md) orders an Element's ADR timeline by frontmatter `date` and leaves git history of ADR files to this ticket.

## Question

How does the Technical resource see how the Workspace changed over time, in the viewer and through MCP? The Workspace is one repo, and a Workspace Bundle can be rebuilt for any commit ([Workspace aggregation](07-workspace-aggregation.md)). Settle: how two points in time are picked (commits, tags, dates), what a diff between two Bundles reports (Elements, Relationships, Deployments and Owners added, removed or changed) and how the viewer shows it, whether past Bundles are built on demand or cached in CI and where, and the MCP tool shape for "what changed".

## Answer

Settled in a grilling session on 2026-11-22. Terms follow [GLOSSARY.md](../../../GLOSSARY.md), which this session updated (Revision, Change).

**Points in time**
- A point in time is a git ref (SHA, tag or branch) or a date. A date resolves to the last commit on the default branch at or before it, walking first parents, so merged PR branches are not points of their own.
- The timeline is made of **Revisions**: default-branch first-parent commits that changed something under the Workspace root. Commits touching only other files are skipped. Tags are shown as milestones; each entry has sha, date, subject and author.
- PR branches are not in the static viewer's timeline in v1. Any ref can still be compared on a checkout through MCP or `archidocs diff`. A per-PR viewer preview belongs to the viewer build and publishing work.

**Past Bundles: CI cache plus on-demand builds**
- **CI** publishes, for every Revision, `bundles/<sha>.json` and a timeline `bundles/index.json` as static files beside the viewer. All are kept (about 1–2 MB each at the scale target, one per Revision). Each index entry holds sha, date, subject, author, tags, change counts, and the qualified ids it changed against the previous entry, computed once at publish time. MCP in `--bundle <url>` mode reads the same files.
- **A checkout** builds a past Bundle on demand by reading files at the commit (`git show`, no worktree), and caches it and its index entry in `.archidocs/cache/` (gitignored).
- **Older schemas:** two Bundles with different `schemaVersion`s are never compared raw. On a checkout, the older Revision is rebuilt with the current Archidocs and the cached Bundle is overwritten. From a Bundle URL, the reader upgrades it in memory through versioned migrations it ships with, or returns `history_unavailable`.
- Where CI publishes these files is left to [Viewer build and publishing](19-viewer-build-publishing.md); this ticket fixes only the layout.
- Amended by [Viewer build and publishing](19-viewer-build-publishing.md): published sites keep full Bundles for the latest 200 Revisions plus tags by default (`--keep all` for every one); older index entries carry `bundle: false`.

**What a diff reports**
- A diff is a flat list of **Changes**, each `added`, `removed` or `changed`, with before and after for every changed field.
- **Covered:** Elements, Relationships, Deployment Targets, Deployments (with URLs and endpoints), Teams, Environments, Projects, Saved View definitions, and ADRs (status, title, links, and whether the body changed).
- **Owner** is diffed as the effective Owner, so an Element whose Owner changed only through its Project's default Owner is listed too.
- **Ignored:** `source` (file and line moves), key order and `builtAt`. Derived edges are not diffed; a reader derives them at each side as it does today.
- **Matching across Bundles:**
  - Elements, Deployment Targets, Teams, Environments, Projects and Saved Views by id (qualified where ids are per Project). ADRs by `project:NNNN`. Deployments by the (Service, Environment, Target) triple.
  - Relationships by id when they have one. Otherwise, a (consumer, provider) pair with exactly one Relationship on both sides matches. Otherwise they match on (pair, technology, interaction). Anything still unmatched is removed plus added.
  - No rename detection in v1: a changed id is removed plus added. A move to a new parent is a change to `parent`.
- An ADR's git history shows only as these ADR Changes; there is no separate per-file git log.

**MCP**
- **`at`** on every read tool takes a ref or a date, as above. On a checkout the server builds that Bundle on demand; on a Bundle URL it loads `bundles/<sha>.json`. A Bundle that can't be had is a typed `isError` with code `history_unavailable`. Write tools never take `at`.
- **`get_changes(from, to?, scope?, kinds?, limit)`:**
  - `from` and `to` are refs or dates; `to` defaults to the commit the server is reading.
  - `scope` is an Element (with its descendants and the Relationships, Deployments and ADRs touching them), a Team (what it owns at either side) or a Project.
  - `kinds` filters by item kind.
  - It returns both resolved commits, counts per kind and the Changes, with the usual `limit` and `truncated`.
- **`list_history(scope?, since?, until?, limit)`:** the Revisions that touched the scope, newest first, each with sha, date, subject, author, tags and change counts. It reads the index's changed ids, so it never diffs N Bundles on the fly.

**Viewer**
- **URL:** `at` and `vs` join the screen state from [Viewer UX](14-viewer-ux.md). Changing either is pushed to browser history.
- **`at`** shows the whole viewer at one past Revision, with a banner and "Back to latest".
- **Compare** (`vs`) is a lens over the current View:
  - The View is laid out over the union of both sides, so removed things keep their place.
  - Added nodes and edges get a green `+`. Removed ones are dashed red ghosts. Changed ones get an amber dot. Unchanged ones dim.
  - A location-bar chip reads "Compare v1.2 → latest", with ✕ to clear it.
  - A Changes list sits beside the canvas; clicking a Change focuses it. Selecting a changed node shows its before and after fields in the Element panel.
  - Points are picked from the Revision timeline, with tags marked.
  - A View that exists at only one side, such as a new Saved View or a removed System's C2, still opens, drawn from the side that has it, with everything marked added or removed.
- **Element panel History tab** (a fifth tab): Revisions that changed the Element or its descendants, from the index. Clicking one opens Compare between that Revision and the one before. The ADRs tab stays ordered by frontmatter `date`.

**CLI**
- **`archidocs history build [--since <ref|date>]`** backfills Bundles and the index for past Revisions, for example when CI publishing is first switched on. It is idempotent and skips Revisions already built.
- **`archidocs diff <from> [<to>] --format text|json|markdown`** prints the Changes. CI can run `archidocs diff origin/main HEAD --format markdown` on a PR and post the result, so reviewers of a Proposed ADR or a Model change see its effect. Posting is the CI user's own step; Archidocs never calls GitHub.

**Handed on**
- Building and publishing the viewer and `bundles/` from CI, including PR previews, graduates from the map's fog into [Viewer build and publishing](19-viewer-build-publishing.md).
