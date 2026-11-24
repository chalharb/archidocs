# 04: Docs home, group index pages and site settings

Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

- **Docs home:** replace the five bullets in `docs/index.mdx` with a card grid by intent: open the demo, quick start, model your architecture, publish the viewer, connect an agent, look something up.
- **Group index pages:** one page each for Start here, Concepts, Guides, Reference and Examples, listing its pages with a line on each. Links to a group go to its index, not its first page.
- **Last updated:** set Starlight's `lastUpdated: true`. The docs build needs full git history for it; check the checkout depth in the workflows that build the site.
- **Version line:** a footer line on every docs page: "Documents Archidocs v<version>, the latest release", with the version read from `package.json`.

## Acceptance criteria

- [ ] The docs home shows the cards, and each links a page that exists.
- [ ] Each of the five groups has an index page, first in its sidebar group.
- [ ] Hand-written pages show a last-updated date on the deployed preview.
- [ ] The footer shows the release version, and a test checks it matches `package.json`.
- [ ] `llms.txt` still indexes every group.
