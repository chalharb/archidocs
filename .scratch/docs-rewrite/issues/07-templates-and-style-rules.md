# 07: Page templates, style rules and their checks

Status: done
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

Write down the four page templates and the style rules from the spec, and check what can be checked.

- **`website/README.md`:** the tutorial, how-to guide, concept and reference templates with their sections in order, and the style rules. One short example of each template.
- **A template test** (`website/test/templates.test.ts`):
  - every page under `guides/` has "Before you start" and "Check it worked" headings;
  - no page under `concepts/` has a numbered step heading;
  - no hand-written page uses a word on a short banned list ("harness").
- **Not-yet-migrated list:** the test takes a list of pages still to migrate, so it passes today. Tickets 08 and 09 empty the list.

The style rules name US spelling as the house spelling ([ticket 01](01-decisions.md)). The pass over existing text, and the spelling list for the banned-word check, are ticket 21.

## Acceptance criteria

- [x] `website/README.md` holds the four templates and the style rules.
- [x] The template test runs in `pnpm docs:test` and fails on a guide without the required headings that isn't on the list.
- [x] The not-yet-migrated list names every current guide and concept page that doesn't yet pass.

## Comments

### Build notes (2026-11-24)

- **`website/README.md`:** how to build and test the site, the four page types, a template for each with its sections in order and a short example, the style rules, and what the test checks. US spelling is rule 10.
- **Headings the templates fix:** tutorial: `## What you'll build`, `## Before you start`, numbered `## 1. …` steps, `## What you learned`, `## Next`. How-to guide: an outcome sentence, the "For agents" callout, `## Before you start`, numbered steps, `## Check it worked`, `## If it didn't`, `## With an agent`, `## Related`. Concept: two sentences, the picture, behavior sections, `## Why it works this way`, `## Related`. Reference: the order only, since each generator names its own headings.
- **Beyond the spec's list:** the README says which sections a guide may leave out ("For agents" with no topic, "If it didn't", "With an agent" on a guide about setting up the agent), which callout marks what (`:::note`, `:::caution`, `:::note[For agents]`), and adds two rules the spec states elsewhere: the Glossary's terms and capitals, and one idea per sentence.
- **`website/test/templates.test.ts`** reads the `.mdx` files and builds nothing. Three rules, each with two tests:
  - a guide has `## Before you start` and `## Check it worked`, at the second level with exactly that text;
  - a concept page has no heading that starts with a number, or with "Step" and a number;
  - no hand-written page (every page under `src/content/docs/` and every intro in `src/intros/`) uses a word in `BANNED_WORDS`, which holds "harness".
- **Not-yet-migrated lists:** one per rule, in the test file. A page off the list that breaks the rule fails the first test; a page on the list that now passes, or is gone, fails the second. So a list only shrinks. Today: all 18 guides (ticket 08 empties it), no concept page (none has a numbered heading, so ticket 09 only has to keep it empty), and three pages for "harness": `concepts/agents-and-mcp`, `guides/agents/connect-mcp` and `guides/agents/install-skill` (ticket 06 empties it).
- **Index pages:** a group's `index.mdx` is left out of the guide and concept rules, because ticket 04 adds one per group and it is a list of pages, not a guide.
- **Banned words read prose:** the frontmatter and the text, without code blocks, inline code and link targets, so an id, file name or URL never fails. A word matches at the start of a word in any case, so "harness" finds "Harnesses". Ticket 21 adds each British spelling as one line: `{ word: "…", instead: "…" },`.
- **Merge order:** whichever of tickets 06 and 08 merges after this one takes its pages off the lists in the same PR. If 06 merges first, this ticket's lists lose `connect-mcp` (and the "harness" list empties) before merge, or the test fails on main.
- **Not checked by a test:** title verbs, the other headings and their order, two links a sentence, output after commands, callout use. The README states them; a reviewer checks them.
