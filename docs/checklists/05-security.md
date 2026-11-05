# Local Application Security

Source: PRD §6. Conventions: [checklists/README.md](README.md). All items are Phase 0 and are tested under TEST-07.

- [ ] **SEC-01** — Next.js server binds to loopback by default
- [ ] **SEC-02** — File operations restricted to configured workspace roots
- [ ] **SEC-03** — Path traversal outside a workspace prohibited
- [ ] **SEC-04** — Unsafe symlink traversal rejected
- [ ] **SEC-05** — YAML parsing executes no arbitrary tags or code
- [ ] **SEC-06** — YAML file-size and parse-depth limits enforced
- [ ] **SEC-07** — State-changing server operations have request-origin protection
- [ ] **SEC-08** — Credentials and secrets aren't stored in architecture YAML (documented guidance, plus detection if feasible)
- [ ] **SEC-09** — All filesystem access via server-side repository services
- [ ] **SEC-10** — Unauthenticated instance not exposed publicly (guarded config and docs warning)
