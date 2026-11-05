# Phase 0 — acceptance criteria

Acceptance criteria for each Phase 0 epic (PRD §9), with the automated tests
that verify them. Requirement IDs refer to the baseline PRD; field-level
schema choices are in [ADD-001](addenda/ADD-001-archdocs-v1-schema.md).

Every epic also meets the shared bar: happy-path and error-path tests,
integration tests at filesystem/service boundaries, `pnpm lint` and
`pnpm format:check` clean, `tsc --noEmit` clean, and coverage thresholds met
(`vitest.config.mts`: 85% overall lines/branches/functions/statements; 95% for
`src/domain/**`, `src/server/fs/**`, `src/server/persistence/**` and the
workspace loader/snapshot).

## P0-01 — Application foundation and testing setup

- Next.js 16 + TypeScript `strict`, ShadCN UI, Tailwind.
- Vitest projects `unit`, `integration`, `component`, `bench` with the V8 coverage provider and enforced thresholds.
- fast-check, React Testing Library, Playwright and axe-core are wired and used by real tests.
- ESLint (`--max-warnings=0`) and Prettier pass; ESLint forbids `fs`/`chokidar` imports outside `src/server` and any I/O in `src/domain`.
- `dev` and `start` bind to `127.0.0.1` (SEC-01).

Tests: `src/server/config.test.ts` (SEC-01), `src/components/workspace-summary.test.tsx`, `tests/e2e/smoke.spec.ts`.

## P0-02 — Canonical TypeScript domain contracts

- Interfaces for all nine resource kinds, the normalized model (entity, relationship, diagram, view instance, layout, collection) and diagnostics (severity, code, file, document, path, line, column, hint, related).
- The Zod schemas' output types are asserted equal to the interfaces at compile time.
- Diagnostics sort deterministically.

Tests: `src/domain/diagnostics.test.ts`, compile-time checks in `src/domain/schema/resource-schemas.ts`.

## P0-03 — YAML schemas and normalization

- Each kind has a strict schema; unknown fields yield `SCHEMA_UNKNOWN_FIELD` with a suggestion; `properties` is the only open map.
- Missing fields, wrong types and boundary values produce `SCHEMA_REQUIRED_FIELD` / `SCHEMA_INVALID_VALUE` with paths and line/column.
- Unsupported `apiVersion` → `SCHEMA_UNSUPPORTED_VERSION`.
- Only YAML 1.2 core tags are accepted; size, depth, document count and alias limits are enforced; reserved keys are rejected; parsing never throws (fuzzed).
- `Entity` and `EntitySet` entries normalize to byte-identical records; the model is identical for any input order (property-based).

Tests: `src/domain/parse.test.ts`, `src/domain/schema/resource-schemas.test.ts`, `src/domain/normalize.test.ts`.

## P0-04 — Workspace discovery and secure file loading

- Discovery returns sorted `*.yaml`/`*.yml` paths, skipping hidden entries and `node_modules`, with file-count and depth limits.
- All access goes through `WorkspaceRoot`: absolute paths, `..` traversal and NUL bytes → `OUTSIDE_ROOT`/`INVALID_PATH`; directory symlinks and escaping file symlinks → `SYMLINK_REJECTED`; writes never follow symlinks; reads check size before loading.

Tests: `src/server/fs/fs.integration.test.ts` (temp directories, real symlinks and permissions).

## P0-05 — Cross-resource validation

- Duplicate IDs per category, collection ID conflicts, duplicate workspaces and layouts.
- Missing references (type, parent, project, relationship type/endpoints, type parents, allowed endpoint types, diagram nodes/edges).
- Parent and type-inheritance cycles, each reported once at a deterministic location.
- Relationship endpoint types honour inheritance and inherited constraints.
- Diagram endpoint mismatches and ambiguity; layout orphans; credential-like properties.

Tests: `src/domain/validate.test.ts`, `src/domain/hierarchy.test.ts`, `src/domain/diagram-resolve.test.ts`, `tests/integration/invalid-fixtures.test.ts`.

## P0-06 — Architecture graph index

- Incoming/outgoing relationships, parent/children, ancestors/descendants, entity→diagram and relationship→diagram reverse lookups, entities by type.
- Rebuilt from scratch per model; identical for any file order; safe on cyclic data.

Tests: `src/domain/graph-index.test.ts`.

## P0-07 — Diagram resolution

- Diagrams resolve to nodes/edges that keep `entityId`/`relationshipId` (DIAG-08).
- Several view instances of one entity, with edges naming instances explicitly (DIAG-09).
- Invalid nodes/edges are dropped and reported.

Tests: `src/domain/diagram-resolve.test.ts`, `src/server/workspace/repository.integration.test.ts`.

## P0-08 — Layout configuration and serialization

- Settings resolve app → workspace → diagram → layout file per key, with the source of each value recorded; generated positions affect positions only.
- Manual positions are kept, new nodes get deterministic generated positions avoiding manual boxes, orphans are reported, collisions are reported without moving saved positions.
- `.layout.yaml` output is byte-deterministic and round-trips through the parser.

Tests: `src/domain/layout/layout.test.ts`.

## P0-09 — Next.js domain service integration

- Route handlers: list/read workspaces, entity and diagram views, reload, layout save, draft save/discard; all go through `WorkspaceService` → `WorkspaceRepository`.
- Host must be loopback (proxy + handlers); writes need same-origin `Origin`, no cross-site `Sec-Fetch-Site`, JSON content type and a body ≤ 1 MiB.
- Errors map to 404/409/413/415/422/500 without leaking internals.

Tests: `src/server/http/request-guard.test.ts`, `src/server/http/handlers.integration.test.ts`, `tests/e2e/smoke.spec.ts`.

## P0-10 — Example workspaces and regression fixtures

- `examples/sample-workspace` covers all nine kinds and all six diagram types and loads with zero diagnostics.
- `tests/fixtures/invalid/<CODE>/` has one workspace per diagnostic class producing exactly that code; a guard test fails if a code lacks coverage.
- `tests/bench/fixture.ts` deterministically generates the 100-entity / 100-node / 150-edge benchmark workspace.

Tests: `src/server/workspace/repository.integration.test.ts` › loading the example workspace, `tests/integration/invalid-fixtures.test.ts`, `tests/integration/performance.test.ts`.

## P0-11 — File watching and safe workspace reload

- External YAML changes are detected (debounced chokidar watcher), validated by a full reload, and applied when valid.
- A failing reload keeps the last valid model, marks it `stale`, and exposes the new diagnostics plus a `MODEL_STALE` notice; fixing the files restores `valid`.
- Reload is available without restart (`POST …/reload`) and runs once when watching starts to close the startup race.

Tests: `src/server/workspace/snapshot.test.ts`, `src/server/workspace/repository.integration.test.ts`.

## P0-12 — Persistence conflict detection and failure recovery

- Layout saves validate first, check the on-disk content hash against the caller's base revision (refusing external edits, deletions and creations), write via fsynced temp file + rename, and touch no other file.
- Write failures leave the original intact and keep the edit as a recoverable draft; drafts are classified `recoverable`/`conflict`/`incompatible`/`corrupt`.
- Concurrent saves are serialized; the second one gets a conflict.

Tests: `src/server/persistence/persistence.integration.test.ts`, `src/server/fs/fs.integration.test.ts` › failure injection, `src/server/workspace/repository.integration.test.ts` › saving layouts.

## P0-13 — Coverage, performance baselines and CI

- Coverage thresholds enforced by `pnpm test:coverage` (fails the run when unmet).
- Benchmarks (`pnpm bench`) and budget tests; baselines and reference hardware in [`performance.md`](performance.md).
- `.github/workflows/ci.yml` runs every PRD §10 gate. Not yet observed on GitHub: the repository has no remote, so branch protection (CI-REQ) is not configured.
