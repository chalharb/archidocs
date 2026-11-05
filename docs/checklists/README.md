# Requirements Checklists

Checkbox version of the effective requirements (baseline PRD v1.6 + accepted [addenda](../addenda/README.md)). Full conventions: [docs/README.md §4](../README.md#4-tracking-progress-checklists).

## Conventions

- `- [ ]` open · `- [x]` done and verified, followed by `— ✅ <evidence>` (test path, PR, or commit)
- Partial progress goes in nested sub-items
- `⛔ blocked: <reason>` marks blocked items
- `~~struck~~ (removed/deferred by ADD-NNN)` items are excluded from progress counts
- `(amended by ADD-NNN)` / `(added by ADD-NNN)` mark items changed by addenda
- Progress counts top-level items only; nested sub-items are working notes

## Progress

<!-- PROGRESS:START -->
| Checklist | Done | Total | % |
|---|---:|---:|---:|
| [00-phase-0-backlog](00-phase-0-backlog.md) | 0 | 27 | 0% |
| [01-model-and-schema](01-model-and-schema.md) | 0 | 29 | 0% |
| [02-diagrams](02-diagrams.md) | 0 | 11 | 0% |
| [03-layout](03-layout.md) | 0 | 27 | 0% |
| [04-reliability](04-reliability.md) | 0 | 21 | 0% |
| [05-security](05-security.md) | 0 | 10 | 0% |
| [06-testing](06-testing.md) | 0 | 34 | 0% |
| [07-performance](07-performance.md) | 0 | 11 | 0% |
| [08-ci-quality-gates](08-ci-quality-gates.md) | 0 | 9 | 0% |
| [09-later-phases](09-later-phases.md) | 0 | 23 | 0% |
| **Total** | **0** | **202** | **0%** |
<!-- PROGRESS:END -->

Regenerate with `scripts/prd-progress.sh --write`.
