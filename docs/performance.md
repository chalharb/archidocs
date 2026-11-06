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
pnpm build && pnpm exec playwright test tests/e2e/performance.spec.ts   # browser budgets (Phase 1)
```

The budget tests assert the median of several runs against the PRD targets,
so a regression that breaks a target fails CI (PERF-04).

## Reference machine (PERF-05)

|            |                                                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| Hardware   | Apple M5, 10 cores, 16 GB RAM, internal SSD                                                                           |
| OS         | macOS 26 (Darwin 25.6.0)                                                                                              |
| Runtime    | Node.js 24.14.0, Vitest 4.1.12; Playwright 1.64 headless Chromium, 1280x800 viewport, production build (`next start`) |
| Conditions | Plugged in, no other heavy processes, warm OS file cache, temp directory on the internal SSD, file watching disabled  |

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

## Phase 1 — 2026-11-05

Same fixture. The diagram has 10 nested boundaries (entities `e0000`..`e0009`
are parents of the others). Browser figures come from
`tests/e2e/performance.spec.ts` and are single runs.

| Operation                                                                         | PRD target |                       Measured |
| --------------------------------------------------------------------------------- | ---------: | -----------------------------: |
| ELK auto-layout, 100 nodes / 150 edges (Re-layout All) — BENCH-03                 |      < 2 s |        mean 149 ms, p99 169 ms |
| Resolve layout, 50 manual + 50 generated positions — PERF-03                      |          — |                   mean 0.14 ms |
| Full diagram view including ELK placement of unplaced nodes (cached) — PERF-04    |          — |                   mean 0.95 ms |
| Node dragging in the browser — BENCH-04                                           |    ~60 FPS | 59.5 FPS, median frame 16.7 ms |
| Node dragging with animated edges (ADD-005) — BENCH-04                            |    ~60 FPS | 60.0 FPS, median frame 16.7 ms |
| Export PNG (2x) / SVG of the whole diagram — BENCH-06                             |      < 5 s |                975 ms / 736 ms |
| Initial render, navigation to 100 nodes and 150 edges visible — PERF-04 rendering |          — |                         917 ms |

The browser budgets fail if dragging drops below a 20 ms median frame, export
takes 5 s or more, or initial render takes 3 s or more.

Generated positions for nodes without saved positions are computed with ELK on
the server and memoized per input (the result is fully determined by it, LAYOUT-21),
so repeated diagram views don't re-run ELK.

## Phase 2 — 2026-11-06

`benchFiles(WITH_MARKDOWN)` adds 200 Markdown resources to the same fixture:
120 `Document` and 80 `Decision` files, each with front matter referencing three
entities and the `bench` diagram, inline `entity:`, `diagram:`, `document:` and
`decision:` links, a fenced code block, and the ADR sections for decisions.
Every fourth decision supersedes the previous one (ADR-03). The fixture loads
with no diagnostics.

| Operation                                                                                            | PRD target |                     Measured |
| ---------------------------------------------------------------------------------------------------- | ---------: | ---------------------------: |
| Cold load, 100 entities + 200 Markdown resources (discover, read, parse, validate, index) — BENCH-07 |    < 1.5 s | mean 337 ms, p99 376 ms (\*) |

(\*) Measured with `pnpm bench` on a GitHub-hosted runner (Linux x86_64, 4 vCPU,
Node.js 24.22.2), not on the reference machine. On that runner the BENCH-01 cold
load took 46 ms against 18.4 ms on the reference machine, so expect the reference
figure to be lower. Replace it with a reference-machine run when one is available.
`tests/integration/performance.test.ts` fails if the median cold load reaches 1.5 s.

Warm reload currently re-reads and re-parses every file; it is listed so that
a future incremental reload can be compared against this baseline.
