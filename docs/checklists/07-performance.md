# Performance

Source: PRD §8. Conventions: [checklists/README.md](README.md). Targets are provisional and measured on the documented reference machine (PERF-05). Record the measured value as evidence when ticking.

## Benchmark targets

- [ ] **BENCH-01** `Phase 0` — Load 100 architecture entities in under 1 s
- [ ] **BENCH-02** `Phase 0` — Resolve 100 nodes and 150 edges in under 200 ms
- [ ] **BENCH-03** `Phase 1` — Auto-layout a medium diagram in under 2 s
- [ ] **BENCH-04** `Phase 1` — Node dragging at about 60 FPS
- [ ] **BENCH-05** `Phase 0` — Save layout YAML in under 500 ms
- [ ] **BENCH-06** `Phase 1` — Export a medium diagram in under 5 s

## Performance requirements

- [ ] **PERF-01** — Repeatable benchmark fixtures
- [ ] **PERF-02** — Cold and warm workspace loading measured
- [ ] **PERF-03** — Layout operations benchmarked with manual overrides
- [ ] **PERF-04** — Regressions in graph resolution and rendering detected
- [ ] **PERF-05** — Reference hardware and test conditions documented
