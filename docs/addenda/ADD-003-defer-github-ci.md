# ADD-003: Defer GitHub-hosted CI until the repository is pushed to GitHub

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Type** | Deferral |
| **Proposed** | 2026-11-05 by Logan Harber |
| **Decided** | 2026-11-05 by Logan Harber |
| **Baseline** | PRD v1.6 |
| **Affected IDs** | CI-01..08, CI-REQ, P0-13, DOD-13 |
| **PRD sections** | §9 (P0-13), §10, §12 |

## Context

PRD §10 requires every pull request to run the CI quality gates, and §12 makes "CI quality gates pass" part of the Phase 0 Definition of Done. The repository is local-only for now: it has no GitHub remote, so there are no pull requests, no hosted CI runs and no branch protection to configure.

The gates themselves exist and pass:

- `.github/workflows/ci.yml` defines every §10 gate (format/lint/types, unit + schema + property-based + integration + component tests with coverage thresholds, production build, Playwright smoke tests).
- The same gates run locally through `pnpm check` and `pnpm test:e2e`.

Only the "runs on GitHub for each PR" part cannot be satisfied yet. Leaving it open would block Phase 0 on an infrastructure decision rather than on the software.

## Change

### CI-01..CI-08 and CI-REQ (deferred)

> Deferred until the repository has a GitHub remote. Reason: no hosted CI or pull requests exist yet.

### P0-13 (modified)

> **Before:** Test coverage, performance baselines, and CI enforcement

> **After:** Test coverage, performance baselines, and CI enforcement. Coverage thresholds and the quality gates are enforced by `pnpm check` / `pnpm test:e2e` and defined in `.github/workflows/ci.yml`; running them on pull requests is deferred (CI-01..08).

### DOD-13 (modified)

> **Before:** CI quality gates pass

> **After:** The CI quality gates pass locally (`pnpm check` and `pnpm test:e2e`). Passing on GitHub is deferred with CI-01..08.

### Interim rule (while deferred)

Before merging into `main`, run `pnpm check` and `pnpm build && pnpm test:e2e` and merge only if both pass. This stands in for CI-REQ's required checks.

### End of the deferral

The deferral ends when a GitHub remote is added. At that point:

1. Push and open a pull request so `.github/workflows/ci.yml` runs.
2. Un-strike CI-01..08 and CI-REQ in `docs/checklists/08-ci-quality-gates.md`, marking them "(reinstated after ADD-003)", and tick each one with the PR run as evidence once it passes.
3. Configure branch protection to require the `quality`, `test` and `build-e2e` jobs (CI-REQ).
4. Add the hosted-CI evidence to P0-13 and DOD-13.

No further addendum is needed to reinstate them.

## Consequences

- Phase 0 can be declared done without a GitHub remote. Its quality bar is unchanged; only where the gates run is deferred.
- Without hosted CI, nothing stops a merge that skips the local gates. The interim rule covers this, but it relies on discipline until branch protection exists.
- Environment differences (Linux runners vs macOS, file-watcher and permission behaviour) won't be caught until the first hosted run. The test suite already handles the known macOS/Linux difference (`unlink` on a directory) and avoids watcher timing assumptions, but expect the first PR run to need minor fixes.

## Checklist updates

Done on acceptance (2026-11-05):

- [x] Struck CI-01..08 and CI-REQ as "(deferred by ADD-003)" in `docs/checklists/08-ci-quality-gates.md`
- [x] Amended P0-13 and DOD-13 in `docs/checklists/00-phase-0-backlog.md` and ticked them with local evidence
- [x] No new requirement IDs
- [x] Ran `scripts/prd-progress.sh --write`
