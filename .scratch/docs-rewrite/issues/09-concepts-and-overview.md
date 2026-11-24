# 09: Concepts trimmed, and "How Archidocs works"

Status: ready-for-agent
Blocked by: 07
Spec: [Docs rewrite proposal](../spec.md)

## What to build

**A new `concepts/how-archidocs-works` page,** first in Concepts: one picture that places Workspace, Project, Team, Element, Relationship, Deployment, View, Revision, the viewer and the MCP server, with a sentence on each and a link to its page. It carries the pipeline now on the introduction (`<Flow>`): YAML in git, `check`, one Model, two ways in.

**The ten concept pages, to the concept template:**

- Open with what the thing is in two sentences, then the picture.
- Move field, selector and status lists to the reference and link them. `elements`, `decisions`, `views` and `deployments` carry such lists today. Keep one YAML sample per page.
- Add "Why it works this way" to each, from the reasoning in `.scratch/archidocs-v1/issues/`: why Relationships point from consumer to provider, why higher-level edges are derived, why Layout is never stored, why `superseded` is derived, why URLs live on Deployments.
- Explain each Glossary term in half a sentence on first use, and keep its link.
- Break up link-chain sentences, such as the Read tools paragraph in `agents-and-mcp`.

**The introduction** becomes "What is Archidocs?": what it is, who it's for, when it isn't the right tool, the persona table, the demos.

`concepts/viewer` stays in this ticket. Ticket 16 folds it into the viewer guides.

## Acceptance criteria

- [ ] `how-archidocs-works` exists, is first in Concepts, and links all ten concept pages.
- [ ] Every concept page passes the template test, and the not-yet-migrated list is empty.
- [ ] Every concept page has a "Why it works this way" section.
- [ ] No concept page lists the fields of a YAML file.
- [ ] No sentence on a concept page has more than two links.
