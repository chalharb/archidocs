# 21: US spelling throughout

Status: done
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

- [x] No hand-written page, intro, guide topic or Glossary entry uses a spelling on the list.
- [x] No generated reference page uses one.
- [x] The banned-word check includes the list and runs in `pnpm docs:test`.
- [x] `website/README.md` names US spelling as the house spelling.
- [x] No id, URL or file name changed, and every test passes.

## Comments

**British spellings in CLI printed messages and viewer UI text:** none found. The pass searched `src/cli/`, `src/render/` and `viewer/src/` for the banned list and for `-ise`, `-our`, `-tre`, `-ogue` and `-lled` forms. The only hits are in code comments ("Colour only on a terminal", "neighbouring headers", "centres the drawing") and in the `aria-labelledby` attribute, which is the HTML name and stays.

**Left alone on purpose:**

- Ids and identifiers: Kitchen Sink's `catalogue` Component id (and the `remove_element` example that names it), the `datacentre` Target kind in test fixtures, `summarise`, `normalise` and `localise` functions, and `pnpm rules:catalogue` with `scripts/rule-catalogue.ts` and `src/core/catalogue.ts`.
- Code comments across `src/`, `viewer/` and `website/src/lib/`, and test names and fixtures in `test/` (the "Data centre" Target and "Authorises a card" Relationship are fixture data in golden SVGs, which readers don't see).
- Files outside this ticket's list: `DESIGN.md`, `PRODUCT.md`, `.impeccable/`, `assets/brand/README.md` and `.scratch/`. They say "colour", "organisation", "grey", "behaviour" and "labelled". A later pass could convert them; the banned-word check doesn't read them.
- `CHANGELOG.md` past entries.

**The check:** `BANNED_WORDS` in `website/test/templates.test.ts` now holds 17 British stems after "harness", and the banned-word check also reads `README.md`, `GLOSSARY.md` and `guide/`.
