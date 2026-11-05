# Performance

Source: PRD §8. Conventions: [checklists/README.md](README.md). Targets are provisional and measured on the documented reference machine (PERF-05). Record the measured value as evidence when ticking.

## Benchmark targets

- [x] **BENCH-01** `Phase 0` — Load 100 architecture entities in under 1 s — ✅ cold load mean 18.4 ms (docs/performance.md, 88dcfeb)
- [x] **BENCH-02** `Phase 0` — Resolve 100 nodes and 150 edges in under 200 ms — ✅ mean 0.023 ms (docs/performance.md, 88dcfeb)
- [x] **BENCH-03** `Phase 1` — Auto-layout a medium diagram in under 2 s — ✅ mean 149 ms (docs/performance.md, tests/integration/performance.test.ts, 2df0b27)
- [x] **BENCH-04** `Phase 1` — Node dragging at about 60 FPS — ✅ 59.5 FPS, 60.0 FPS with animated edges (docs/performance.md, tests/e2e/performance.spec.ts, 2df0b27)
- [x] **BENCH-05** `Phase 0` — Save layout YAML in under 500 ms — ✅ mean 24.3 ms (docs/performance.md, 88dcfeb)
- [x] **BENCH-06** `Phase 1` — Export a medium diagram in under 5 s — ✅ PNG 975 ms / SVG 736 ms (docs/performance.md, tests/e2e/performance.spec.ts, 2df0b27)

## Performance requirements

- [x] **PERF-01** — Repeatable benchmark fixtures — ✅ tests/bench/fixture.ts, determinism asserted in tests/integration/performance.test.ts (88dcfeb)
- [x] **PERF-02** — Cold and warm workspace loading measured — ✅ cold 18.4 ms / warm 17.3 ms, tests/bench/workspace.bench.ts (88dcfeb)
- [x] **PERF-03** — Layout operations benchmarked with manual overrides — ✅ resolve layout with 50 manual overrides 0.054 ms (88dcfeb)
- [x] **PERF-04** — Regressions in graph resolution and rendering detected — ✅ rendering budgets in tests/e2e/performance.spec.ts (2df0b27)
  - [x] Graph resolution, loading and saving: budget tests fail CI on regression — tests/integration/performance.test.ts (88dcfeb)
  - [x] Rendering (Phase 1)
- [x] **PERF-05** — Reference hardware and test conditions documented — ✅ docs/performance.md › Reference machine (88dcfeb)

## Phase 2 (added by ADD-009)

- [ ] **BENCH-07** `Phase 2` — Load 100 entities and 200 Markdown resources in under 1.5 s, cold (added by ADD-009)
