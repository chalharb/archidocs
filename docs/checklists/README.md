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
| [00-phase-0-backlog](00-phase-0-backlog.md) | 27 | 27 | 100% |
| [01-model-and-schema](01-model-and-schema.md) | 29 | 29 | 100% |
| [02-diagrams](02-diagrams.md) | 12 | 13 | 92% |
| [03-layout](03-layout.md) | 28 | 28 | 100% |
| [04-reliability](04-reliability.md) | 21 | 21 | 100% |
| [05-security](05-security.md) | 10 | 10 | 100% |
| [06-testing](06-testing.md) | 34 | 34 | 100% |
| [07-performance](07-performance.md) | 11 | 11 | 100% |
| [08-ci-quality-gates](08-ci-quality-gates.md) | 0 | 0 | 0% |
| [09-later-phases](09-later-phases.md) | 0 | 24 | 0% |
| **Total** | **172** | **197** | **87%** |
<!-- PROGRESS:END -->

Regenerate with `scripts/prd-progress.sh --write`.
