# 06: Hand-written docs content

Status: done
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

- [x] Every page in the tree exists and the site builds (links validated).
- [x] No Model YAML sample is typed inline; every one comes from `examples/` or `website/samples/`.
- [x] The failure-samples test and the tutorial end-to-end test run in CI.

## Comments

### Build notes (2026-11-23)

- **Sample fences:** a code fence with an empty body and `file="examples/…"` (plus optional `region="…"`) is filled from that file by a Sätteri mdast plugin (`website/src/plugins/samples.ts`, `src/lib/samples.ts`); its title is the file's path in the Workspace. Regions are `#region <name>` / `#endregion` comments (`<!-- #region -->` in Markdown), moved to the left margin. A fence with code typed into it, or a missing file or region, fails the build (fixture tests).
- **Failure samples:** each folder in `website/samples/` is a small Workspace. A page shows one with `file="website/samples/…" fails="<rule-id>"`, titled "· fails check: <rule-id>". `website/test/samples.test.ts` checks that each fails `archidocs check` with exactly that rule, that its page links the rule's page, that every sample is shown somewhere, and that no `yaml` fence on a hand-written page or intro holds Model YAML.
- **Markdown copies:** `starlight-llm-actions` now uses `src/render-markdown.ts`, which fills sample fences, turns `<Diagram>` into an image and a live-viewer link, and drops MDX imports and `<Flow>`/`<Steps>` tags. Before this, `.md` copies of pages with samples would have had empty fences.
- **Glossary anchors:** each Glossary term gets `#term-<slug>` (`#term-deployment-target`), so Concepts pages link a term's entry.
- **Tutorial:** its finished repo is `examples/tutorial/` (Workspace and workflow). `website/scripts/tutorial.ts` (`pnpm docs:tutorial`, the new CI `tutorial` job) turns the page into one shell script, with a heredoc per file it shows, runs it in a temp folder with this repo's CLI, and checks the files add up to `examples/tutorial/` and the site holds the Model. It skips `npm install --global archidocs`, `archidocs dev` and `git push`.
- **Kitchen sink:** gained `tags`, `links`, `in` (`sink/reporting.yaml`), `endpoints`, a View with `exclude` and an Impact Lens, a Dynamic View and an ADR, so the Model YAML intros can show every feature. Big Bank gained region markers only.
- **Search:** concept pages that use a flag's word as plain prose can outrank the CLI page (`--direction` did, on the Views page); `website/e2e/search.spec.ts` catches it.
- **Left for ticket 08:** `docs/publishing.md` is split into `guides/publish/` but not deleted, and the `action.yml` and GitLab template comments still point at it.
