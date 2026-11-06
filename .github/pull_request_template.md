<!-- Title: Conventional Commits, e.g. "feat(diagrams): add flowchart view" — it becomes the squash-merge subject. -->

## Summary

<!-- What changed and why, in 2–5 sentences. -->

## Linked issue

Closes #<!-- issue number -->

## Requirements

<!-- Requirement IDs this PR satisfies or touches (PRD / addenda), e.g. DIAG-13, SEC-11. Note any addendum consulted. -->

-

## Acceptance criteria

<!-- Copy each acceptance criterion from the issue and say how it is met (test, screenshot, file). -->

- [ ]

## Test evidence

<!-- New or changed tests, and the local results of `pnpm check` (and `pnpm test:e2e` for UI changes). -->

-

## Checklist

- [ ] `pnpm check` passes locally (format, lint, types, coverage thresholds, build)
- [ ] Tests added or updated for every behaviour change (PRD §7 coverage targets hold)
- [ ] Checklist items in `docs/checklists/` ticked with evidence, and `scripts/prd-progress.sh --write` run
- [ ] No edits to `docs/Archidocs-prd.md`; requirement changes go through an addendum
- [ ] Filesystem access stays in `src/server` repository services (SEC-09)
- [ ] UI changes are keyboard accessible, labelled, and meet colour contrast

## Screenshots

<!-- UI changes only. -->
