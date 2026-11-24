# How the docs site serves agents

Type: grilling
Status: resolved
Blocked by: 01
Map: [Archidocs docs site](../map.md)

## Question

What does archidocs.dev give agents? Decide on `llms.txt` / `llms-full.txt`, a raw Markdown copy of each page, how the site relates to `archidocs guide` and the MCP `get_authoring_guide` tool (one source, or a link and nothing more?), and whether agent-facing pages differ from human pages at all.

## Answer

**Humans and agents read the same pages.** There are no agent-only pages or hidden blocks. The site serves those pages to agents in three ways:

- **`llms.txt` files** from `starlight-llms-txt`:
  - `llms.txt`: an index of every docs page with one-line descriptions.
  - `llms-full.txt`: every docs page in full.
  - `llms-small.txt`: the same, minus Examples and the Changelog.

  The landing page is left out of all three.
- **A Markdown copy of each page** at `<page-url>.md`, plus a "Copy as Markdown" button on every page, from `starlight-llm-actions`. If the build shows the plugin can't write those as static files, a small hand-written endpoint that returns each page's source (`entry.body`) replaces it.
- **Pointers to the installed version:** the top of `llms.txt` and the agents-and-MCP concept page tell agents that if they can run Archidocs, `archidocs guide` or the MCP `get_authoring_guide` tool is the better source, because it matches the installed version. The site is latest only.

**One source for agent topics:** `guide/` is the single source for the agent topics, served by the CLI, by MCP and by the site's Reference › Authoring guide for agents.

**Human Guides and agent topics stay two hand-written sources.** Each human Guide links to its matching agent topic. Checking that the two agree is a review job, not a build job.
