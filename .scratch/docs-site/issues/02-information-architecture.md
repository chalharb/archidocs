# What is the docs site's page tree

Type: grilling
Status: resolved
Blocked by: 01
Map: [Archidocs docs site](../map.md)

## Question

What is the page tree of archidocs.dev, framed by Diátaxis (tutorials, how-to guides, reference, explanation) for adopters who set up a Workspace, author Projects, wire up CI and connect agents? Which pages exist, in what order, and where does each piece of existing content (README sections, `docs/publishing.md`, `docs/rules.md`, `guide/` topics, `GLOSSARY.md`, the examples) land? What does the first-run path from "what is this?" to a published viewer look like?

## Answer

The sidebar has five groups, named for readers rather than by Diátaxis terms: **Start here**, **Concepts**, **Guides**, **Reference** and **Examples**. The landing page is at `/`. Every docs page lives under `/docs/<group>/…`, which leaves room for per-release copies later at `/docs/1.x/…`.

```text
/                          landing page (landing-page ticket)
/docs/
  start/        introduction · quick-start · tutorial
  concepts/     workspace-and-projects · elements · relationships · teams-and-ownership
                · deployments · views · revisions-and-history · decisions · viewer
                · agents-and-mcp
  guides/
    model/      add-a-project · add-a-service · connect-services · add-deployments
                · save-a-view · dynamic-views · record-an-adr · rename-move-remove
    publish/    github-pages · gitlab-pages · pr-previews · saved-view-images · other-hosts
    agents/     connect-mcp · install-skill · bootstrap-from-code
    review/     diff · export
  reference/
    cli/        init · check · dev · build · export · diff · mcp · guide · version
    model/      workspace-yaml · project-yaml · model-yaml · deployments-yaml · views-yaml
    mcp/        read-tools · write-tools   (an anchor per tool)
    ci/         github-action · gitlab-template
    rules/      index + one page per rule
    agent-guide/  SKILL.md + topics
    glossary
    changelog
  examples/     big-bank · kitchen-sink
```

**Where existing content lands:**

| Source | Lands at |
| --- | --- |
| README "Why" + persona table | `start/introduction`, plus a flow diagram (Project YAML → `check` → Model → viewer and MCP) and links to the demos |
| README Quick start | `start/quick-start` |
| README "Agents and MCP" | `concepts/agents-and-mcp` |
| `docs/publishing.md` | split into the five `guides/publish/` pages; the PR comment recipe goes in `pr-previews` |
| `docs/rules.md` | `reference/rules/`: an index plus a page per rule at `/docs/reference/rules/<rule-id>/`, so check output and `validation_failed` can link straight to a rule |
| `guide/` (SKILL.md + topics) | rendered as-is under `reference/agent-guide/`; its `rules` topic is the `reference/rules/` section |
| `GLOSSARY.md` | `reference/glossary`: short definitions. Concepts pages explain, and link each term to its entry on first use |
| `CHANGELOG.md` | `reference/changelog` |
| `action.yml`, `templates/gitlab` | `reference/ci/` |
| `PRODUCT.md`, `DESIGN.md` | stay as contributor docs; not published |

**Other decisions:**
- **Tutorial:** one end-to-end tutorial, "Model your first system". It goes from an empty repo through `init`, one Project with a few Services, a Relationship, a Deployment, `check` and `dev`, to publishing on GitHub Pages. It builds a small slice of Big Bank, so readers can then compare it with the full demo.
- **Guides vs agent topics:** the human Guides are hand-written how-tos for the same tasks as the agent topics. The agent topics are published as-is under Reference. Whether the two share a source is decided in the agents-as-readers ticket.
- **The viewer:** one Concepts page explains it (lenses, deep links, Save as View, Revisions and compare). There's no viewer manual.
- **The README** keeps a short pitch and links out to the site.
- **The Bundle format** stays internal and isn't documented.
