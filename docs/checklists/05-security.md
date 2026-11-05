# Local Application Security

Source: PRD §6. Conventions: [checklists/README.md](README.md). All items are Phase 0 and are tested under TEST-07.

- [x] **SEC-01** — Next.js server binds to loopback by default — ✅ package.json scripts `-H 127.0.0.1`; src/server/config.test.ts › SEC-01 (57e6a56)
- [x] **SEC-02** — File operations restricted to configured workspace roots — ✅ src/server/fs/fs.integration.test.ts › SEC-02/03 (0b9418e)
- [x] **SEC-03** — Path traversal outside a workspace prohibited — ✅ src/server/fs/fs.integration.test.ts › rejects traversal/absolute path (0b9418e)
- [x] **SEC-04** — Unsafe symlink traversal rejected — ✅ src/server/fs/fs.integration.test.ts › SEC-04 symlinks (0b9418e)
- [x] **SEC-05** — YAML parsing executes no arbitrary tags or code — ✅ src/domain/parse.test.ts › unsupported YAML types and safety (71ac6c9)
- [x] **SEC-06** — YAML file-size and parse-depth limits enforced — ✅ parse.test.ts › size/depth/alias limits; fs.integration.test.ts › size limits (71ac6c9, 0b9418e)
- [x] **SEC-07** — State-changing server operations have request-origin protection — ✅ src/server/http/request-guard.test.ts, handlers.integration.test.ts, tests/e2e/smoke.spec.ts (58c2506, 0a913ee)
- [x] **SEC-08** — Credentials and secrets aren't stored in architecture YAML (documented guidance, plus detection if feasible) — ✅ README security guidance + SECRET_SUSPECTED warnings, src/domain/validate.test.ts › secret detection (0f11a18)
- [x] **SEC-09** — All filesystem access via server-side repository services — ✅ ESLint no-restricted-imports outside src/server (5fa9462); all routes go through WorkspaceService (58c2506)
- [x] **SEC-10** — Unauthenticated instance not exposed publicly (guarded config and docs warning) — ✅ Host allow-list in src/proxy.ts and handlers, README warning; request-guard.test.ts, tests/e2e/smoke.spec.ts › SEC-10 (58c2506, 0a913ee)
