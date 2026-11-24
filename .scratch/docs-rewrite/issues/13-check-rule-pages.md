# 13: Check rule pages that say why

Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

Rule pages show a failing example, the fix and the fixed file. They don't say why the rule exists or what `check` prints, and the index is one flat table of 45 rules.

- **Registry fields:** add to each rule in `src/core/rules.ts`:
  - `why`: one or two sentences on what goes wrong without the rule;
  - `area`: workspace, elements, relationships, deployments, views or decisions;
  - `since`: the release that added it, from the git history;
  - `related`: other rule ids, where there are any.
- **Message as printed:** the build runs `check` on the rule's failing example and shows the line it prints, under "What check reports".
- **Rule page order:** summary, severity and since, What check reports, Why, Failing example, Fix, Fixed, Related rules.
- **Index:** grouped by area, one table each.

Rule ids and URLs don't change. The agent guide's `rules` topic uses `ruleCatalogue()`: keep its output as it is, or change it on purpose in this ticket.

## Acceptance criteria

- [ ] `why`, `area` and `since` are required by the rule type, so a new rule can't omit them.
- [ ] Every rule page shows the exact line `check` prints for its failing example.
- [ ] The index groups the rules by area, and every rule is in exactly one group.
- [ ] Every `related` id names a current rule (unit test).
- [ ] Every existing rule URL still resolves, removed-rule stubs included.
