# Architecture Docs

Local-first software architecture documentation. Architecture is defined in
YAML (`archdocs/v1`); diagrams resolve from that model, and presentation
(positions, styles) is stored separately in `.layout.yaml` files.

Requirements live in [`docs/`](docs/README.md) (baseline PRD v1.7). Phase 0
(the YAML model foundation) and Phase 1 (diagram viewer and layout editor) are
implemented; see [`docs/phase-0-acceptance.md`](docs/phase-0-acceptance.md) and
[`docs/phase-1-acceptance.md`](docs/phase-1-acceptance.md). Phase 2
(documentation and ADRs) is in progress; its requirements are in
[ADD-009](docs/addenda/ADD-009-phase-2-documentation-and-adrs.md).

## Getting started

Requires Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev            # http://127.0.0.1:3000, serving examples/sample-workspace
```

Open a diagram from the home page to view and arrange it. Layout changes are
saved to the diagram's `.layout.yaml`; entities and relationships are edited
in YAML.

## Configuration

| Variable                  | Default                     | Purpose                                                                                                     |
| ------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ARCHIDOC_WORKSPACES`     | `examples/sample-workspace` | Comma-separated workspace roots, `key=path` or bare paths. Only these directories are ever read or written. |
| `ARCHIDOC_WATCH`          | on                          | Set to `0` to disable reloading on external file changes.                                                   |
| `ARCHIDOC_MAX_FILE_BYTES` | `1048576`                   | Per-file YAML size limit.                                                                                   |
| `ARCHIDOC_ALLOWED_HOSTS`  | _(none)_                    | Extra hostnames accepted besides loopback.                                                                  |
| `ARCHIDOC_READ_ONLY`      | off (on when hosted)        | Set to `1` to refuse every write (layout saves and drafts).                                                 |

## Deploying to Vercel

The app can be deployed to Vercel as a **read-only viewer** (hosted read-only
mode, [ADD-010](docs/addenda/ADD-010-hosted-read-only-mode.md)). Import the
repository in Vercel and deploy; no settings are required.

- The workspaces in `ARCHIDOC_WORKSPACES` (default `examples/sample-workspace`)
  are bundled at build time, so they must live inside the repository. Their
  `.yaml`, `.yml` and `.md` files are deployed; local `.archidoc/` drafts are not.
- On Vercel the app is read-only and doesn't watch files. **Edit layout** is
  disabled; edit locally, commit and redeploy instead.
- The deployment's own `*.vercel.app` hostnames are accepted automatically. Add
  custom domains to `ARCHIDOC_ALLOWED_HOSTS`.
- **Anyone who can reach the deployment can read the architecture.** For
  private architecture, turn on Vercel Deployment Protection.

## Security

> **Do not expose a writable server to a network.** The app has no authentication.
> The only supported hosted setup is the read-only Vercel deployment above.
> `pnpm dev` and `pnpm start` bind to `127.0.0.1`, and every request whose
> `Host` header is not a loopback address is rejected (this also blocks DNS
> rebinding). `ARCHIDOC_ALLOWED_HOSTS` weakens that protection; only use it on
> a trusted network.

- File access is confined to the configured workspace roots: no absolute paths,
  no `..` traversal, no directory symlinks, no writes through symlinks.
- YAML is parsed with the YAML 1.2 core schema only; custom tags are rejected.
- Writes require a same-origin `Origin` header and a JSON body.
- Never put credentials in architecture YAML; credential-like property names
  are flagged with `SECRET_SUSPECTED` warnings.

## Development

```bash
pnpm check          # format, lint, typecheck, tests with coverage, production build
pnpm test           # all Vitest projects (unit, integration, component)
pnpm test:e2e       # Playwright E2E, visual regression and browser perf (run `pnpm build` first)
pnpm bench          # performance benchmarks (see docs/performance.md)
```

| Path                         | Contents                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/`                | Pure, framework-free model: contracts, schemas, parsing, normalization, validation, graph index, diagram and layout resolution, ELK      |
| `src/editor/`                | Pure layout-editor logic: document, geometry, undo history, React Flow conversion                                                        |
| `src/components/diagram/`    | React Flow diagram viewer and layout editor                                                                                              |
| `src/server/`                | The only code that touches the filesystem (enforced by ESLint): secure workspace access, persistence, repository, watcher, HTTP handlers |
| `src/app/`                   | Next.js routes and pages (thin adapters over `src/server`)                                                                               |
| `examples/sample-workspace/` | Complete example covering every resource kind and diagram type                                                                           |
| `tests/`                     | Shared helpers, invalid-input fixtures, integration, benchmark and Playwright suites                                                     |
