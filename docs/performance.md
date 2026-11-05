# Performance baselines

PRD §8 targets, measured with the deterministic benchmark fixture in
[`tests/bench/fixture.ts`](../tests/bench/fixture.ts) (PERF-01): 100 entities
(half individual `Entity` files, half in one `EntitySet`), 150 relationships,
one diagram with 100 nodes and 150 edges, and a layout file with 50 manual
positions.

## How to run

```bash
pnpm bench                                   # Vitest benchmarks, JSON in bench-results/latest.json
pnpm vitest run tests/integration/performance.test.ts   # budget assertions (runs in CI)
```

The budget tests assert the median of several runs against the PRD targets,
so a regression that breaks a target fails CI (PERF-04).

## Reference machine (PERF-05)

|            |                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| Hardware   | Apple M5, 10 cores, 16 GB RAM, internal SSD                                                                          |
| OS         | macOS 26 (Darwin 25.6.0)                                                                                             |
| Runtime    | Node.js 24.14.0, Vitest 4.1.12                                                                                       |
| Conditions | Plugged in, no other heavy processes, warm OS file cache, temp directory on the internal SSD, file watching disabled |

## Baseline — 2026-11-05

| Operation                                                                                             | PRD target |     Mean |      p99 |
| ----------------------------------------------------------------------------------------------------- | ---------: | -------: | -------: |
| Cold load, 100 entities (open repository: discover, read, parse, validate, index) — BENCH-01, PERF-02 |      < 1 s |  18.4 ms |  22.7 ms |
| Warm reload, 100 entities, unchanged files — PERF-02                                                  |          — |  17.3 ms |  19.6 ms |
| Build graph index                                                                                     |          — |  0.10 ms |  0.20 ms |
| Resolve 100 nodes / 150 edges — BENCH-02                                                              |   < 200 ms | 0.023 ms | 0.061 ms |
| Resolve layout, 50 manual + 50 generated positions — PERF-03                                          |          — | 0.054 ms |  0.11 ms |
| Full diagram view (resolve + settings + layout + draft check)                                         |          — |  0.11 ms |  0.21 ms |
| Save layout YAML (validate, conflict check, atomic write, reload) — BENCH-05                          |   < 500 ms |  24.3 ms |  26.5 ms |

Phase 1 adds auto-layout (BENCH-03), dragging (BENCH-04) and export (BENCH-06).

Warm reload currently re-reads and re-parses every file; it is listed so that
a future incremental reload can be compared against this baseline.
