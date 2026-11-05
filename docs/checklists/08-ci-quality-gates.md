# CI Quality Gates

Source: PRD §10. Conventions: [checklists/README.md](README.md). The PRD lists these gates unnumbered; the `CI-` IDs are assigned here.

Each pull request runs:

- [ ] **CI-01** — Formatting and lint checks
- [ ] **CI-02** — TypeScript type checking
- [ ] **CI-03** — Domain unit tests
- [ ] **CI-04** — Schema and property-based tests
- [ ] **CI-05** — Filesystem integration tests
- [ ] **CI-06** — Coverage threshold validation
- [ ] **CI-07** — Production build verification
- [ ] **CI-08** — Playwright smoke tests (once the UI exists)

- [ ] **CI-REQ** — Required checks must pass before merge (branch protection configured)
