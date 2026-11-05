# CI Quality Gates

Source: PRD §10. Conventions: [checklists/README.md](README.md). The PRD lists these gates unnumbered; the `CI-` IDs are assigned here.

Each pull request runs:

> Deferred by [ADD-003](../addenda/ADD-003-defer-github-ci.md) until the repository has a GitHub remote. Meanwhile, run `pnpm check` and `pnpm build && pnpm test:e2e` before merging into `main`. ADD-003 lists the reinstatement steps.

- [ ] ~~**CI-01** — Formatting and lint checks~~ (deferred by ADD-003)
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
- [ ] ~~**CI-02** — TypeScript type checking~~ (deferred by ADD-003)
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
- [ ] ~~**CI-03** — Domain unit tests~~ (deferred by ADD-003)
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
- [ ] ~~**CI-04** — Schema and property-based tests~~ (deferred by ADD-003)
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
- [ ] ~~**CI-05** — Filesystem integration tests~~ (deferred by ADD-003)
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
- [ ] ~~**CI-06** — Coverage threshold validation~~ (deferred by ADD-003)
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
- [ ] ~~**CI-07** — Production build verification~~ (deferred by ADD-003)
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
- [ ] ~~**CI-08** — Playwright smoke tests (once the UI exists)~~ (deferred by ADD-003)
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)

- [ ] ~~**CI-REQ** — Required checks must pass before merge (branch protection configured)~~ (deferred by ADD-003)
  - [ ] When reinstated: mark the `quality`, `test` and `build-e2e` jobs as required checks
