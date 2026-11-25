# 04: Docs home, group index pages and site settings

Status: done
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

- **Docs home:** replace the five bullets in `docs/index.mdx` with a card grid by intent: open the demo, quick start, model your architecture, publish the viewer, connect an agent, look something up.
- **Group index pages:** one page each for Start here, Concepts, Guides, Reference and Examples, listing its pages with a line on each. Links to a group go to its index, not its first page.
- **Last updated:** set Starlight's `lastUpdated: true`. The docs build needs full git history for it; check the checkout depth in the workflows that build the site.
- **Version line:** a footer line on every docs page: "Documents Archidocs v<version>, the latest release", with the version read from `package.json`.

## Acceptance criteria

- [x] The docs home shows the cards, and each links a page that exists.
- [x] Each of the five groups has an index page, first in its sidebar group.
- [ ] Hand-written pages show a last-updated date on the deployed preview.
- [x] The footer shows the release version, and a test checks it matches `package.json`.
- [x] `llms.txt` still indexes every group.

## Comments

### Build notes (2026-11-24)

- **Docs home:** six cards in Starlight's `CardGrid`, then one sentence linking the five group indexes. "Model your architecture" and "Publish the viewer" link the Guides index at `#model` and `#publish`. The cards use `src/components/LinkCard.astro`, Starlight's `LinkCard` with a screen-reader-only ": " between title and description: without it llms\*.txt, which is made from the page's HTML, ran the two together.
- **Group indexes:** `index.mdx` in `start/`, `concepts/`, `guides/`, `reference/` and `examples/`, each with `sidebar: { label: Overview, order: 0 }`, as the generated CLI and agent-guide indexes already have. Guides and Reference are made of sub-groups, so their indexes are named in the sidebar config.
- **Page lists are generated:** `<PageList directory="docs/concepts" />` (`src/components/PageList.astro`, `src/lib/page-list.ts`) lists a folder's pages from the docs collection in the sidebar's order, each with its `description`. A page added to a folder is on its index without an edit. A listed page with no `description` fails the build.
- **Reference index is hand-written:** its sections are generated and three of them (Model YAML, MCP tools, CI) have no page of their own, so the index names the eight sections. `website/test/wayfinding.test.ts` fails if the sidebar gains a Reference section the index doesn't link.
- **Markdown copies:** `src/render-markdown.ts` writes `<LinkCard>` and `<PageList>` as Markdown lists and drops `<CardGrid>`. The renderer is now async, because a page list needs the collection.
- **Last updated:** `lastUpdated: true`, with `fetch-depth: 0` on the deploy job in `sites.yml` and the `docs` job in `publish.yml`. Generated pages have no file, so they show no date. A new page shows no date until it is committed.
- **Footer:** `src/components/Footer.astro` wraps Starlight's and adds "Documents Archidocs v<version>, the latest release.", marked `data-pagefind-ignore` so search doesn't match it on every page.
- **llms.txt:** a group's index has the folder's own id (`docs/start`), which `docs/start/**` doesn't match, so each set names it. Added an Examples set: there was none, so llms.txt didn't index that group. `docs/examples` is also excluded from llms-small.txt.
- **Fixture builds:** `test/support.ts` now links `node_modules` into the temp copy. A copied page that imports a package (`@astrojs/starlight/components`) couldn't resolve it from outside the repo, which any page using `Tabs` or `Steps` will also hit.
- **Also changed:** the "Concepts" link at the end of `start/introduction` and the landing page's "Examples" link now go to the group index.
- **Dates on the deployed preview:** not confirmed when this was written; see the pull request.
