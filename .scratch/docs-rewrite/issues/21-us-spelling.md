# 21: US spelling throughout

Status: ready-for-agent
Blocked by: 07
Spec: [Docs rewrite proposal](../spec.md)

## What to build

The docs use British spelling ("organisation", "colour", "data centre"). [Ticket 01](01-decisions.md) chose US spelling. Make one pass, then keep it that way.

- **Hand-written text:** every page under `website/src/content/docs/`, the intros in `website/src/intros/`, the landing page, `README.md`, `GLOSSARY.md` and `guide/`.
- **Generated text, at its source:** rule summaries and fixes in `src/core/rules.ts`, command and flag descriptions in `src/cli/commands.ts`, MCP tool descriptions in `src/mcp/`, schema descriptions in `src/schema/`, and the descriptions in `action.yml` and the GitLab template.
- **Examples:** names and descriptions in `examples/` and `website/samples/` that readers see on pages, such as Big Bank's "data centre".
- **Leave alone:** ids, URLs, file names, code identifiers, quoted names of other products, and the Changelog's past entries.
- **Keep it:** add a short list of British spellings to the banned-word check from ticket 07, so a new one fails `pnpm docs:test`.

Changing an example's display name can change exported diagrams and test snapshots. Update them in the same PR.

The CLI's printed messages and the viewer's UI text aren't in this ticket. If the pass finds British spellings there, list them in a comment on this ticket.

## Acceptance criteria

- [ ] No hand-written page, intro, guide topic or Glossary entry uses a spelling on the list.
- [ ] No generated reference page uses one.
- [ ] The banned-word check includes the list and runs in `pnpm docs:test`.
- [ ] `website/README.md` names US spelling as the house spelling.
- [ ] No id, URL or file name changed, and every test passes.
