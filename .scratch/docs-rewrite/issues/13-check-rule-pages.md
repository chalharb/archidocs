# 13: Check rule pages that say why

Status: done
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

- [x] `why`, `area` and `since` are required by the rule type, so a new rule can't omit them.
- [x] Every rule page shows the exact line `check` prints for its failing example.
- [x] The index groups the rules by area, and every rule is in exactly one group.
- [x] Every `related` id names a current rule (unit test).
- [x] Every existing rule URL still resolves, removed-rule stubs included.

## Comments

### Build notes (2026-11-24)

- **Registry fields:** `RuleDefinition` gains `area` (a `RuleArea`, one of the six in `ruleAreas`), `since`, `why` and optional `related`. The first three are required by the type; `test/core/rules.test.ts` holds `@ts-expect-error` lines that stop compiling if one becomes optional.
- **`since`:** all 45 rules are `1.0.0`. The id list in `src/core/rules.ts` is the same at `v1.0.0`, `v1.1.0`, `v1.2.0` and `main`; the last commit to add a rule (#27) is in `v1.0.0`.
- **Areas:** workspace 11, elements 5, relationships 6, deployments 3, views 11, decisions 9. Parse and schema rules, `unknown-team`, `unknown-project` and `own-project-prefix` are in workspace; `unknown-element` and `wrong-kind` in elements; `unknown-environment` and `unknown-target` in deployments.
- **What check reports:** `website/src/reference/rules.ts` loads each failing example from memory (`overlayFileSystem` over an empty file system) and formats each of the rule's issues with the CLI's own `formatText`. The example is its own repo root, so the paths match the file names the page shows. `website/test/reference.test.ts` runs the real CLI over every failing example and compares the lines.
- **Build failures:** the build throws if a failing example doesn't report its rule, or a `related` id names no current rule.
- **Other rules in an example:** three failing examples also report another rule (`ancestor-descendant-participants` reports `missing-step`; `target-outside-environment` and `unresolved-path` report `empty-view`). The page shows only its own rule's lines and names the other rule in a sentence below. The examples are unchanged.
- **Files shown:** the failing example now also shows any file a reported line points into. Four rules report in a file the fix doesn't change (`duplicate-id`, `duplicate-deployment`, `duplicate-view-id`, `supersedes-cycle`).
- **`rulePages()` is async** now, so `website/src/reference/index.ts` awaits it.
- **Rule catalogue:** `ruleCatalogue()`, `docs/rules.md` and `archidocs guide rules` are unchanged, byte for byte. `why` and `related` are on the site only.
- **URLs:** no rule id or URL changed. A test holds the 45 ids released so far and fails if one has neither a page nor a removed-rule stub.
- **`why` to review:** no design ticket gives a reason for `self-relationship`; its `why` follows from the Glossary's Relationship and Upstream / Downstream entries.
