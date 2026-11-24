# 06: Hand-written docs content

Status: ready-for-agent
Blocked by: 04
Spec: [Archidocs docs site](../../docs-site/spec.md)

## What to build

Write every hand-written page in the [page tree](../../docs-site/issues/02-information-architecture.md), checked as [hand-written correctness](../../docs-site/issues/08-hand-written-correctness.md) requires.

- **Start here:**
  - `introduction`: the README's Why and persona table, a flow diagram, and links to the demos.
  - `quick-start`.
  - `tutorial` ("Model your first system": a Big Bank slice from `init` to publishing on GitHub Pages).
- **Concepts:** the ten pages. Each links a term to its Glossary entry on first use; `agents-and-mcp` says the CLI and MCP guide match the installed version.
- **Guides:**
  - `model/`: eight pages, each linking to its agent topic.
  - `publish/`: five pages, split from `docs/publishing.md`; the PR comment recipe goes in `pr-previews`.
  - `agents/` (three pages) and `review/` (two pages).
- **Reference:** hand-written intros for the Model YAML pages, with Kitchen sink examples.
- **Examples:** the two pages.
- **YAML samples:** included from `examples/` by path and named region (a small remark or component include). Samples that are wrong on purpose go in `website/samples/`, each with a test that it fails with exactly the rule its page names.
- **Tutorial test:** an end-to-end test that runs the tutorial in a temp folder on every PR, like the `action` CI job.

## Acceptance criteria

- [ ] Every page in the tree exists and the site builds (links validated).
- [ ] No Model YAML sample is typed inline; every one comes from `examples/` or `website/samples/`.
- [ ] The failure-samples test and the tutorial end-to-end test run in CI.
