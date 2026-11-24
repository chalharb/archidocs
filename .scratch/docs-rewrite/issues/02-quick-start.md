# 02: A quick start that reaches a result

Status: ready-for-agent
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

- [ ] Following only the page, from an empty repo, `archidocs check` reports 0 errors and the viewer shows two Services in one System.
- [ ] Every file on the page comes from `examples/quick-start/`.
- [ ] The end-to-end test runs in CI on every PR.
- [ ] The page takes under five minutes to follow and never sends the reader to another page to finish.
