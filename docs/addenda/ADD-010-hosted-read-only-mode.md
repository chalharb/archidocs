# ADD-010: Hosted read-only mode (Vercel)

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Type** | Change |
| **Proposed** | 2026-11-05 by Claude, at Logan Harber's request |
| **Decided** | 2026-11-05 by Logan Harber |
| **Baseline** | PRD v1.7 |
| **Affected IDs** | SEC-13 (new), SEC-01, SEC-10, RELI-01, LAYOUT-08, DIAG-12, RELI-11 |
| **PRD sections** | §5, §6 |

## Context

The product owner wants to deploy the app to Vercel so diagrams and documentation can be viewed without running it locally. The baseline is local-first: SEC-01 binds to loopback, and SEC-10 says an unauthenticated instance must not be exposed as a public service.

A Vercel deployment can't satisfy the write-related requirements anyway. Its filesystem is read-only and is replaced on every deploy, so layout saves (LAYOUT-08) and drafts (RELI-11) can't persist, and file watching (RELI-01) has nothing to watch. Long-lived event streams also keep serverless functions running.

## Change

### SEC-13 (new)

> When running on Vercel, the app runs in hosted read-only mode: every write (layout saves, drafts, draft discards) is refused, layouts are reported as not writable with the reason, file watching is off, and the change-event endpoint answers `204 No Content` so clients don't hold connections open. The deployment's own Vercel hostnames are accepted automatically, and `ARCHIDOC_ALLOWED_HOSTS` adds custom domains. `ARCHIDOC_READ_ONLY` and `ARCHIDOC_WATCH` override the defaults, and read-only mode can also be used locally. — Priority: P1, Phase 2

### SEC-01 and SEC-10 (amended)

> **Before (SEC-10):** An unauthenticated MVP instance must not be exposed as a public service.

> **After (SEC-10):** An unauthenticated instance must not be exposed as a public service, except in hosted read-only mode (SEC-13), which can't modify anything. The deployment is readable by anyone who can reach it. For private architecture, enable Vercel Deployment Protection, which the app doesn't enforce.

SEC-01 (loopback binding) still applies to `pnpm dev` and `pnpm start`. On Vercel, binding is managed by the platform.

### Unchanged behaviour, made explicit

- LAYOUT-08, RELI-11, DIAG-12: in hosted mode, **Edit layout** is disabled with the read-only reason, and the API answers `409 NOT_WRITABLE` to write requests.
- RELI-01: in hosted mode the workspace is loaded once per server instance and doesn't change until the next deploy.
- SEC-02..07 still apply. The workspace roots, path confinement, symlink rules, YAML limits and request-origin checks are unchanged.

### Deployment packaging

Workspace folders are read at runtime, so the build lists every configured root within the project (`ARCHIDOC_WORKSPACES`, default `examples/sample-workspace`) for output file tracing. Only `.yaml`, `.yml` and `.md` files are included, so local app state such as `.archidoc/` drafts is never deployed. Roots outside the project can't be bundled.

## Consequences

- Viewing on Vercel needs no configuration beyond deploying. Custom domains need `ARCHIDOC_ALLOWED_HOSTS`.
- Editing remains a local workflow: edit YAML or layouts locally, commit, and redeploy. Saving from a hosted deployment (for example by committing to Git) belongs to Phase 4.
- A public deployment exposes the architecture model and documentation to anyone with the URL. The README warns about this and recommends Deployment Protection.

## Checklist updates

Done on acceptance (2026-11-05):

- [x] Added SEC-13 to `docs/checklists/05-security.md` with "(added by ADD-010)"
- [x] Noted "(amended by ADD-010)" on SEC-10
- [x] Recorded SEC-13 in the allocated-IDs table
- [x] Ran `scripts/prd-progress.sh --write`
