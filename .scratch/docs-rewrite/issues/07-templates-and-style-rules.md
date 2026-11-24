# 07: Page templates, style rules and their checks

Status: ready-for-agent
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

- [ ] `website/README.md` holds the four templates and the style rules.
- [ ] The template test runs in `pnpm docs:test` and fails on a guide without the required headings that isn't on the list.
- [ ] The not-yet-migrated list names every current guide and concept page that doesn't yet pass.
