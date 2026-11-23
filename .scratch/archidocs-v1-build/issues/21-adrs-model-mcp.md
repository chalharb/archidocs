# 21: ADRs: model, check and MCP

Status: done
Assignee: Claude (ticket-21 session)
Blocked by: 09, 17
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

Decisions live as markdown beside the Model, linked to it, and agents can read and propose them.

- Files are `<project>/adr/NNNN-slug.md`, with `template.md` excluded. Ids are `project:NNNN`.
- The title is the first `# ` heading.
- Frontmatter: `status` and `date` are required; `decision-makers`, `consulted`, `informed`, `tags`, `elements`, `views` and `supersedes` are optional.
- `supersededBy` and the effective status are derived once the new ADR is accepted.
- The Bundle's `adrs` slot.
- MCP:
  - `list_adrs(element?, status?, tag?)`: covers descendants (not ancestors), newest first, with `matchedVia`.
  - `get_adr`.
  - `get_element.adrs`.
  - `propose_adr(project, title, elements?, views?, supersedes?, body?, dry_run)`: takes the next free number and fills the Project template, else the Workspace template (`adr-template.md`), else MADR minimal.
- `remove_element`, `remove_target` and `remove_view` are refused while an ADR links the item.
- ADR rules: bad frontmatter or status, missing title, bad filename, duplicate number, unknown links or `supersedes`, a hand-written `superseded`, a `supersedes` cycle, and the two `supersedes` warnings.

## Acceptance criteria

- [x] Acceptance test for the Technical resource question: read the ADRs for an Element, and propose one.
- [x] A template override at each level is picked correctly.
- [x] Each ADR rule has failing and passing fixtures.
