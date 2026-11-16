# AGENTS.md

Archidocs is an npm package that turns a repository of FINOS CALM architecture files into a
read-only, linkable static site. The source of truth for what to build is
[.notes/requirements.md](.notes/requirements.md); read it before starting any issue.

## Commands

| Command             | What it does                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `npm ci`            | Install dependencies (also installs the commit-msg hook)             |
| `npm run build`     | Build the viewer and the CLI into `dist/`                            |
| `npm run lint`      | ESLint and a Prettier check                                          |
| `npm run format`    | Fix formatting with Prettier                                         |
| `npm run typecheck` | Type-check the package and the viewer                                |
| `npm run test:unit` | Vitest with coverage; thresholds are enforced in `vitest.config.ts`  |
| `npm run test:e2e`  | Playwright against the built site, at `/` and at `/.notes/archi/`    |
| `npm run test:pack` | Pack the package, install it in a temp folder, `init`, `build`, load |
| `npm test`          | Everything above, in order                                           |

Run `npm run build` before `test:e2e`; it uses `dist/`.

### Running end-to-end tests locally

```bash
npx playwright install chromium   # once
npm run build
npm run test:e2e
```

Playwright builds two copies of the starter site into `.e2e/`, then serves them with a plain
static file server (`tests/support/static-server.mjs`): one at `/` and one under `/.notes/archi/`.
There is no app server. Use `npx playwright test --ui` to debug.

## Layout

```
src/cli/       the `archidocs` command: init, validate, dev, build
src/core/      config schema and loading, CALM model loading, shared types
src/layout/    elkjs layout, build time only
src/index.ts   public API (defineConfig)
viewer/        Vite + React SPA, prebuilt into dist/viewer and shipped in the package
tests/unit/    Vitest tests
tests/e2e/     Playwright tests
tests/pack/    packaging test
tests/fixtures/models/   valid and invalid CALM fixtures
scripts/       build script and the GitHub setup script
.notes/        requirements, decision records (adr/) and design notes
```

The config schema in `src/core/config-schema.ts` is the single source of truth. Both the JSON
Schema (`dist/config.schema.json`) and the `defineConfig` type are derived from it. Never edit
one without the other: change the schema constant.

## Conventions

- **Conventional Commits**: `type(scope): subject`. Types: feat, fix, docs, style, refactor,
  perf, test, build, ci, chore, revert. Scopes: cli, core, layout, viewer, config, ci, docs, deps.
  A commit-msg hook runs commitlint. PRs are squash-merged using the PR title.
- **Branches**: `<type>/<issue#>-<slug>`, for example `feat/12-validate-command`.
- **Pull requests**: use the template, include `Closes #<n>` and fill the AC -> test table.
- **Tests**: names describe behaviour ("reports the file and field of an invalid config"). Never
  put issue numbers or requirement ids in test names or code comments. Every acceptance
  criterion needs at least one test.
- **No `.only` or `.skip`**: lint fails on them. Do not lower coverage thresholds.
- **Comments** describe behaviour. They do not refer to tickets or to requirement ids.
- A change that adds a dependency or a technology choice adds a decision record in `.notes/adr/`.
- TypeScript is strict and ESM. Node 22.

## Principles

- Reference model first; sample content in the package exists only as fixtures and the `init` starter.
- Thin slices: each is used on the reference model before the next starts.
- Static first: the site is files. A server is added only beside it, for a feature that cannot work without one.
- Read-only: no screen creates, edits or deletes content.
- Content is plain files in the author's repository; the model stays valid CALM.
- One bad file never breaks the site.
- Nothing to build on the consumer's side; the package ships a finished viewer.
- Outcomes, not screens. Every requirement has a check, and nothing is built without a job.
- elkjs is build-time only and must never enter the viewer bundle.

## Non-goals

- Editing diagrams or models in the browser.
- Sign-in, roles or administration built into the app.
- Server-side state of any kind.
- A general diagramming tool; Archidocs draws what the model says.
- Replacing the model format's own validation tools.
- Matching a prototype pixel for pixel.

If an issue asks for something on this list, stop and ask instead of building it.

## Protected paths

Do not edit these unless the issue says so; they are owned by a human via CODEOWNERS:

- `.github/` (workflows, templates, CODEOWNERS)
- `AGENTS.md`
- `.notes/adr/` (add a new record rather than changing an accepted one, and only when asked)
- `eslint.config.js`, `commitlint.config.js`, `.husky/`
- `vitest.config.ts`, `vitest.pack.config.ts`, `playwright.config.ts`
- `scripts/setup-github.sh`

Never delete, skip or weaken an existing test to make a change pass.
