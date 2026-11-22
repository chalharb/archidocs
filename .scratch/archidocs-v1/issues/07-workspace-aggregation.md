# Workspace aggregation

Type: grilling
Status: resolved
Assignee: Logan Harber
Blocked by: 05
Map: [Archidocs v1](../map.md)

## Question

How does a Workspace find and combine its Projects? Settle: the Workspace manifest (a list of git URLs, or a registry that Projects publish into), how Elements in one Project refer to Elements in another (id namespacing), version pinning vs always-latest, handling of conflicts and duplicate ids, where the Workspace-wide definitions (Teams and Environments) live, and the Workspace Bundle format.

## Answer

Settled in a grilling session on 2026-11-21. Terms follow [GLOSSARY.md](../../../GLOSSARY.md), which this session updated (Workspace, Project, Qualified id, Workspace Bundle).

**v1 scope: one repo**
- A Workspace is **one git repo**. Aggregating Projects across several repos is out of scope for v1 and left to a later effort, which also owns cross-repo version pinning.
- Because every Project is read at the same commit, there is nothing to pin: a Bundle is built from one commit and records its SHA.
- `archidocs check` validates the whole Workspace in one pass; there is no fetching of a published Bundle.

**Layout on disk**
- **Workspace root:** the folder holding `workspace.yaml`, by default `archidocs/` at the repo root so the repo can hold other things. The CLI finds it by walking up from the current folder.
- **`workspace.yaml`** holds the Workspace-wide definitions: `teams` and `environments`. They may be defined only here; declaring one anywhere else is an error.
- **Project:** any folder below the root containing a `project.yaml` (`id`, `name`, `owner`). Every `*.yaml` beneath it, in whatever subfolders the authors like, belongs to that Project.
- **Discovery:** Projects are auto-discovered; there is no Project list. Errors: a `project.yaml` nested inside another Project's folder, a model file outside every Project, and two Projects with the same id.

**References**
- A bare id refers to the same Project. `project:id` refers to an Element or Deployment Target in another Project (for example `to: payments:gateway`). A Project may not prefix its own ids, so each thing has one spelling.
- Teams and Environments are referred to by bare ids everywhere, since they are global to the Workspace.
- The **qualified id** `project:id` is the canonical form in the Bundle and in MCP. Namespacing is kept, even within one repo, to avoid clashes like `api` or `db` across about 50 Teams, and to make the later move to cross-repo a matter of moving folders.

**Workspace Bundle**
- One JSON file, `workspace.bundle.json`, checked against a zod-generated schema, with keys in a fixed order so that diffs are stable.
- **Header:** `schemaVersion`, `commit`, `builtAt`.
- **Definitions:** `teams` and `environments`.
- **Projects:** `projects` with id, name, owner and folder.
- **Model:**
  - `elements` as a flat list keyed by qualified id, with `kind` and `parent`.
  - `relationships`, declared only (whoever reads the Bundle computes the derived edges).
  - `targets` and `deployments`.
- **Source:** every item carries `source: {file, line}`.
- ADRs, Views and Layout get slots that their own tickets fill.

**History**
- Workspace history is the repo's git history. A Bundle is a build output that can be rebuilt for any commit and cached; snapshots are not archived.
- How changes are shown, and the caching, are left to [History UX](15-history-ux.md).
