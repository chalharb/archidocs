# Contributing to Archidocs

Thanks for helping. This file says how to set up the repo, run the tests and the docs site, and open a pull request. Terms such as Workspace, Project and Model follow [GLOSSARY.md](GLOSSARY.md).

To report a security problem, don't open an issue. Follow [SECURITY.md](SECURITY.md). Everyone who takes part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions, bugs and ideas

- **A question:** open an [issue](https://github.com/chalharb/archidocs/issues/new). Check [Troubleshooting](https://archidocs.dev/docs/help/troubleshooting/) and the [FAQ](https://archidocs.dev/docs/help/faq/) first.
- **A bug:** open a [bug report](https://github.com/chalharb/archidocs/issues/new?template=bug_report.yml). Say which CLI version you ran, the command, and what it printed.
- **An accessibility barrier:** open a [bug report](https://github.com/chalharb/archidocs/issues/new?template=bug_report.yml&labels=accessibility) with the `accessibility` label. [ACCESSIBILITY.md](ACCESSIBILITY.md) says what we aim for and what we know falls short.
- **An idea:** open a [feature request](https://github.com/chalharb/archidocs/issues/new?template=feature_request.yml). Say what you were trying to do before how Archidocs should do it. It's filed as a **Request** and triaged: planned as a Feature, made into a Task, or closed with the reason why.

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

CLI tests call the CLI in-process, through `archidocs()` in `test/support/cli.ts`. Only `test/cli/binary.test.ts` and `test/cli/mcp.test.ts` spawn the binary, so a new CLI test should use `archidocs()`.

Some files are generated from the source. Run these after you change it, and commit the result:

| Command | When to run it |
| --- | --- |
| `pnpm schemas` | After you change the Model's schema in `src/schema/`. It writes `schemas/`. |

## Work on the docs site

The site at [archidocs.dev](https://archidocs.dev) is built from `website/`. Serve it locally with `pnpm docs:dev`, and test it with `pnpm docs:test`.

The other commands, the page templates and the style rules are in [website/README.md](website/README.md). Read it before you write a page.

## Open a pull request

1. Start from an issue. Every pull request closes one, however small the change: if there is none for your work, open a [bug report](https://github.com/chalharb/archidocs/issues/new?template=bug_report.yml) or a [feature request](https://github.com/chalharb/archidocs/issues/new?template=feature_request.yml) first.
2. Branch from `beta`, the default branch. Unreleased work lands there; `main` holds only what is released.
3. Make one change per pull request, with tests for it.
4. Run the checks above that cover what you changed.
5. Write commit messages and the pull request title as [Conventional Commits](https://www.conventionalcommits.org/): `fix(cli): …`, `feat(viewer): …`, `docs(guides): …`. Releases and their notes on [GitHub Releases](https://github.com/chalharb/archidocs/releases) are made from them.
6. Open the pull request against `beta`, and fill in the [template](.github/pull_request_template.md): `Closes #<n>`, What changed, Why, Verification and For reviewers. It is squash-merged, so its title becomes the commit message.

## How releases work

Releases are made by [semantic-release](https://semantic-release.gitbook.io/) (`release.config.mjs`, run by `.github/workflows/publish.yml`, which `.github/workflows/ci.yml` calls as its last job on a push to `main` or `beta`, once every other CI job has passed), from the commit types since the last release: `fix` makes a patch, `feat` a minor, and `!` or `BREAKING CHANGE` a major. The reasons for this setup are in [ADR 0002](docs/adr/0002-beta-branch-with-semantic-release.md), [ADR 0003](docs/adr/0003-release-gated-on-ci.md), [ADR 0006](docs/adr/0006-promote-by-fast-forward.md) and [ADR 0007](docs/adr/0007-release-is-ci-last-job.md). Every release, beta or stable, carries npm provenance.

- **Every merge into `beta` that calls for a release publishes a beta**, such as `1.5.0-beta.1`, to the npm `beta` dist-tag, with a GitHub prerelease. The release commits `package.json` with that version to `beta` and tags the commit. It also deploys the docs and the demos to [beta.archidocs.dev](https://beta.archidocs.dev), [beta.big-bank.archidocs.dev](https://beta.big-bank.archidocs.dev) and [beta.kitchen-sink.archidocs.dev](https://beta.kitchen-sink.archidocs.dev). A beta never moves the Action's `v1` tag.
- **The maintainer promotes the newest beta** by running the **Promote** workflow (Actions → Promote → Run workflow). It commits `package.json` with the stable version, `1.5.0` for `1.5.0-beta.N`, to `beta`, then moves `main` forward to that same commit. CI runs on `main`, and the release publishes the stable version to `latest` without committing anything, moves `v1` and deploys the production sites. Promote refuses when that version is already released, or when a commit after the newest beta would itself release: let its beta publish first.
- **There is no pull request into `main`, and nothing is merged back.** `main` only ever moves to a commit of `beta`, so it is always behind or level with `beta`.
- **An urgent fix goes through `beta` too**: a pull request into `beta`, then a promotion once its beta has published. If `beta` holds something that can't ship, revert it on `beta` first.

### Try a beta

- **CLI:** `npx archidocs@beta`, or `npm install --global archidocs@beta`.
- **GitHub Action:** keep `chalharb/archidocs@v1` and set `version: beta`.
- **GitLab template:** set the `version` input to `beta`.
- **Docs:** [beta.archidocs.dev](https://beta.archidocs.dev) documents the `beta` branch; its footer names the commit.

## How work is tracked

Everything is tracked in GitHub issues, on the [Archidocs Project](https://github.com/users/chalharb/projects/8):

- Bugs and requests from users arrive as issues of type **Bug** and **Request**.
- Planned work follows Epic → Feature → Task. A **Feature** issue holds the feature's spec, with its user stories; its **Tasks** are sub-issues, one per pull request. An **Epic** groups several Features.
- An issue's **Status** on the Project says where it stands; the board's columns are the statuses.
- A pull request that implements a Task says `Closes #<n>`, and the Task closes when it merges.

Specs and tickets from before the move were Markdown files under `.scratch/`. They're in git at [`.scratch/` @ 2ada153](https://github.com/chalharb/archidocs/tree/2ada153/.scratch).

The conventions are in [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) and [docs/agents/triage-labels.md](docs/agents/triage-labels.md). Design and product notes are in [PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md).

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE), like the rest of the repo.
