# 02: A quick start that reaches a result

Status: done
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

Rewrite `start/quick-start` so a reader who only copies from the page ends with a viewer that shows something. Today `archidocs init` writes an empty `workspace.yaml` and the page shows no other file.

- **Example:** a new `examples/quick-start/` Workspace: `workspace.yaml` (one Team, one Environment), `shop/project.yaml`, and `shop/model.yaml` (one Person, one System, two Services, two Relationships). It isn't deployed as a demo.
- **Page:** install (tabs for npm, pnpm and npx), `archidocs init`, the three files in full with their paths as titles, `archidocs check` with its output, `archidocs dev` with a picture of the C2 Landscape that appears, then Next. The files are included from the example, never typed inline.
- **Picture:** an exported diagram for now. Ticket 15 replaces it with a screenshot.
- **Test:** an end-to-end test like the tutorial's (`website/scripts/tutorial.ts`): run the page's steps in a temp folder and check the files add up to `examples/quick-start/` and `check` passes.
- **README:** its Quick start section follows the same steps.

[Ticket 01](01-decisions.md) settled that the files are pasted: there is no `archidocs init --example` flag.

## Acceptance criteria

- [x] Following only the page, from an empty repo, `archidocs check` reports 0 errors and the viewer shows two Services in one System.
- [x] Every file on the page comes from `examples/quick-start/`.
- [x] The end-to-end test runs in CI on every PR.
- [x] The page takes under five minutes to follow and never sends the reader to another page to finish.

## Comments

### Build notes (2026-11-24)

- **Example:** `examples/quick-start/archidocs/` holds the three files: Team `storefront`, Environment `prod`, Project `shop`, and a Shopper who uses an Online Shop System (`shop:online-shop`) of two Services, Web and API. It has no `wrangler.jsonc` and is not in the `sites.yml` matrix, so it is never deployed.
- **Page:** five numbered steps and Next. The files are sample fences with `title="archidocs/…"`, so each title is the path from the repo root, where the reader saves it. The npx tab has no code block: it says to put `npx` before each command.
- **Two pictures, not one:** the viewer opens on the C2 Landscape with Online Shop closed, so the Services only show after one click. The page shows the C2 Landscape as it appears (`c2`), then tells the reader to select the arrow button on the Online Shop box and shows that View (`c2/shop:online-shop`). `archidocs export` can't open a box on the C2 Landscape (there is no flag for it), so a single picture of the Landscape with the box open wasn't possible without changing the CLI. Ticket 15's screenshot can be either state.
- **Diagrams of a Workspace that isn't a demo:** `website/src/lib/examples.ts` gained `UNDEPLOYED`, a list beside `EXAMPLES` for Workspaces that pages show but that have no demo site and no Examples page. Each names the Generated Views to export (the quick start has no Saved Views). `<Diagram view="quick-start/c2" />` works as before and leaves out the "Open in the live viewer" link, in the page and in its `.md` copy. `EXAMPLES` and `findExample` are unchanged, so the landing page and the Examples pages see only demos.
- **Tabs in `.md` copies:** `src/render-markdown.ts` writes each `<TabItem label="…">` as its label in bold above what it holds, and drops the `<Tabs>` tags.
- **Fixture builds:** a page that imports a package by name (`@astrojs/starlight/components`) broke the fixture builds in `website/test/fixtures.test.ts`, which copy `src/content/` to a temp folder where the package can't be found. `website/test/support.ts` now links `node_modules` beside the copy. Any later page that uses Tabs needs this.
- **End-to-end test:** `website/scripts/walkthrough.ts` holds what the tutorial script and the new `website/scripts/quick-start.ts` share (page to shell script, run in a temp folder, files add up to the example). `pnpm docs:quick-start` and the CI `quick-start` job run the page in an empty repo and check that `archidocs check` finds nothing and prints what the page shows, and that the Bundle holds one Team, one Environment, one Person and one System with both Services in it. It skips the two install lines and `archidocs dev`. `archidocs check` also prints `0 errors, 0 warnings` for the empty starter Workspace, which is why the test reads the Bundle.
- **README:** its Quick start has the same five steps with the three files typed in full, since GitHub can't include them. The same script fails when the README's `archidocs` commands, files or `check` output differ from the page's.
- **Not run locally:** `pnpm test:e2e` (Playwright), because it reuses servers on fixed ports that other worktrees share. CI runs it.
