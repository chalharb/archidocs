# CI Quality Gates

Source: PRD §10. Conventions: [checklists/README.md](README.md). The PRD lists these gates unnumbered; the `CI-` IDs are assigned here.

Each pull request runs:

- [ ] **CI-01** — Formatting and lint checks
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
  - [ ] Observed passing on a pull request ⛔ blocked: repository has no GitHub remote yet
- [ ] **CI-02** — TypeScript type checking
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
  - [ ] Observed passing on a pull request ⛔ blocked: repository has no GitHub remote yet
- [ ] **CI-03** — Domain unit tests
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
  - [ ] Observed passing on a pull request ⛔ blocked: repository has no GitHub remote yet
- [ ] **CI-04** — Schema and property-based tests
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
  - [ ] Observed passing on a pull request ⛔ blocked: repository has no GitHub remote yet
- [ ] **CI-05** — Filesystem integration tests
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
  - [ ] Observed passing on a pull request ⛔ blocked: repository has no GitHub remote yet
- [ ] **CI-06** — Coverage threshold validation
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
  - [ ] Observed passing on a pull request ⛔ blocked: repository has no GitHub remote yet
- [ ] **CI-07** — Production build verification
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
  - [ ] Observed passing on a pull request ⛔ blocked: repository has no GitHub remote yet
- [ ] **CI-08** — Playwright smoke tests (once the UI exists)
  - [x] Job defined in .github/workflows/ci.yml and passing locally via `pnpm check` / `pnpm test:e2e` (c72d633)
  - [ ] Observed passing on a pull request ⛔ blocked: repository has no GitHub remote yet

- [ ] **CI-REQ** — Required checks must pass before merge (branch protection configured)
  - [ ] ⛔ blocked: needs a GitHub remote; mark the quality, test and build-e2e jobs as required checks
