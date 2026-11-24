# 08: Cutover and first production deploy

Status: ready-for-agent
Blocked by: 04, 05, 06, 07
Spec: [Archidocs docs site](../../docs-site/spec.md)

## What to build

Retire the old docs and launch the site in one PR ([content sources](../../docs-site/issues/05-content-sources.md), [README cut](../../docs-site/issues/10-readme-cut.md), [hand-written correctness](../../docs-site/issues/08-hand-written-correctness.md)).

- **Old rules catalogue:** delete `docs/rules.md`, `scripts/rule-catalogue.ts`, the `rules:catalogue` script, and the catalogue-file assertion in `test/core/catalogue.test.ts`. Keep `ruleCatalogue()` for the guide's `rules` topic.
- **Old publishing doc:** delete `docs/publishing.md`, and repoint its comments in `action.yml` and `templates/gitlab/archidocs.gitlab-ci.yml` to the `guides/publish/` URLs.
- **README:** cut it to about 70 lines, keeping the pitch with a docs link, Why, Quick start, Examples, Development and License. The Model, CLI, Publishing, and Agents and MCP sections each become one or two sentences plus a link. Run the CLI-line check over the README.
- **External links:** add a weekly scheduled workflow (e.g. lychee) that checks external links in the site and the README and opens an issue on failure.
- **Launch:** cut a release, so production deploys from its tag.

## Acceptance criteria

- [ ] Nothing in the repo links to `docs/rules.md` or `docs/publishing.md`.
- [ ] The README is about 70 lines, and every site link in it resolves on the production site.
- [ ] The weekly link-check workflow runs with `workflow_dispatch` and passes.
- [ ] archidocs.dev serves the released docs.
