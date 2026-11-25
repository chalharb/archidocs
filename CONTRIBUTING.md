# Contributing to Archidocs

Thanks for helping. This file says how to set up the repo, run the tests and the docs site, and open a pull request. Terms such as Workspace, Project and Model follow [GLOSSARY.md](GLOSSARY.md).

To report a security problem, don't open an issue. Follow [SECURITY.md](SECURITY.md). Everyone who takes part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions, bugs and ideas

- **A question:** open an [issue](https://github.com/chalharb/archidocs/issues/new). Check [Troubleshooting](https://archidocs.dev/docs/help/troubleshooting/) and the [FAQ](https://archidocs.dev/docs/help/faq/) first.
- **A bug:** open a [bug report](https://github.com/chalharb/archidocs/issues/new?template=bug_report.yml). Say which CLI version you ran, the command, and what it printed.
- **An idea:** open a [feature request](https://github.com/chalharb/archidocs/issues/new?template=feature_request.yml). Say what you were trying to do before how Archidocs should do it.

## Set up

You need Node.js 22.18 or later and pnpm 10. Corepack installs the pnpm version the repo pins in `package.json`:

```bash
corepack enable
```

Install the dependencies from the repo root:

```bash
pnpm install
```

Serve the viewer for a Workspace, with live reload. Run it from a folder that holds a Workspace, such as `examples/big-bank`:

```bash
pnpm dev
```

## Run the checks

CI runs all of these on every pull request.

| Command | What it does |
| --- | --- |
| `pnpm lint` | ESLint over the repo. |
| `pnpm typecheck` | TypeScript over the CLI, the viewer and the docs site. |
| `pnpm test` | The unit tests, with Vitest. |
| `pnpm build` | Builds the CLI into `dist/` and the viewer. |
| `pnpm test:e2e` | Opens the viewer and the docs site in a browser, with Playwright. Run `pnpm exec playwright install chromium` once first. |

Some files are generated from the source. Run these after you change it, and commit the result:

| Command | When to run it |
| --- | --- |
| `pnpm schemas` | After you change the Model's schema in `src/schema/`. It writes `schemas/`. |
| `pnpm rules:catalogue` | After you add or change a check rule in `src/core/rules.ts`. It writes `docs/rules.md`. |

## Work on the docs site

The site at [archidocs.dev](https://archidocs.dev) is built from `website/`. Serve it locally with `pnpm docs:dev`, and test it with `pnpm docs:test`.

The other commands, the page templates and the style rules are in [website/README.md](website/README.md). Read it before you write a page.

## Open a pull request

1. Branch from `main`.
2. Make one change per pull request, with tests for it.
3. Run the checks above that cover what you changed.
4. Write commit messages and the pull request title as [Conventional Commits](https://www.conventionalcommits.org/): `fix(cli): …`, `feat(viewer): …`, `docs(guides): …`. Releases and `CHANGELOG.md` are made from them. Don't edit the changelog by hand.
5. Open the pull request against `main`. Say what changed and why, and link the issue or ticket it closes.

## How work is tracked

Bugs and requests from users arrive as GitHub issues. Planned work is tracked in the repo, as Markdown files under `.scratch/`:

- Each feature has a folder, `.scratch/<feature>/`, with its spec in `spec.md`.
- The spec is split into tickets, one file each: `.scratch/<feature>/issues/<NN>-<slug>.md`.
- A `Status:` line near the top of each ticket says where it stands.
- Comments on a ticket go at the bottom of its file, under `## Comments`.
- When a pull request implements a ticket, it sets the ticket's `Status: done` in the same change.

The conventions are in [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) and [docs/agents/triage-labels.md](docs/agents/triage-labels.md). Design and product notes are in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md).

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE), like the rest of the repo.
