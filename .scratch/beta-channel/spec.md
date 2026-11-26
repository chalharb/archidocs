# Beta channel

Status: ready-for-agent

A way to try a release candidate before anyone on `latest` gets it: every push to a `beta` branch publishes `X.Y.Z-beta.N` to npm and deploys the docs and demo sites to `beta.` hosts. Settled in a grilling session on 2026-11-26; the why is in [ADR 0002](../../docs/adr/0002-beta-branch-with-semantic-release.md).

## Problem Statement

The only way to see a change in a published package is to release it.

- **Every release goes straight to `latest`.** `.github/workflows/publish.yml` runs release-please on `main`; merging its release PR tags `vX.Y.Z`, publishes to npm with no dist-tag (so `latest`), moves `v1` and deploys archidocs.dev. There is no channel in between.
- **Nothing can be installed from a branch.** A candidate can be built locally, but not as users get it: `npx archidocs@…`, the Action with `version:`, or the GitLab template with `inputs.version`.
- **The ahead-of-release docs host is half a channel.** `next.archidocs.dev` (`website/wrangler.jsonc:22-33`, deployed by `sites.yml:57`) shows `main`'s docs, but the demos deploy straight to production on every push to `main` (`sites.yml:58-59`), ahead of the CLI they show.

## Solution

Two long-lived branches, both released by semantic-release:

- **`beta`** is the default branch. Feature PRs squash-merge into it. Every push publishes a prerelease to the npm `beta` dist-tag and deploys all three sites to their `beta.` hosts.
- **`main`** holds what is released. `beta` reaches it through a promotion PR merged with a merge commit. Every push publishes a stable release to `latest`, commits `package.json` and `CHANGELOG.md` back, moves `v1`, and deploys all three sites to production. Urgent fixes go to `main` directly; after each stable release a PR merges `main` back into `beta`.

A candidate is tried with `npx archidocs@beta`, the Action's `version: beta`, the GitLab template's `version: beta`, and `beta.archidocs.dev`.

## Implementation Decisions

### Release tool

- release-please goes: `release-please-config.json`, `.release-please-manifest.json` and the `release-please` job in `publish.yml`. Its settings are carried over, not lost: the release notes keep today's sections (Features, Bug fixes, Performance, Reverts shown; docs, style, refactor, test, ci, chore hidden) through the `conventionalcommits` preset in both `@semantic-release/commit-analyzer` and `@semantic-release/release-notes-generator`. Tags stay `vX.Y.Z` (no component in the tag, as now).
- `branches: ["main", { name: "beta", prerelease: true }]`. A prerelease branch named `beta` publishes `-beta.N` versions to the `beta` channel (dist-tag) by default; nothing overrides that. The first beta after a stable `1.3.2` with a `feat` is `1.4.0-beta.1` (semantic-release counts from `.1`).
- **Plugins differ by branch.** The config is a `release.config.js` (or `.mjs`) that reads the branch from `GITHUB_REF_NAME`:
  - both: `commit-analyzer`, `release-notes-generator`, `@semantic-release/npm`, `@semantic-release/github` (which marks a prerelease's GitHub Release as a prerelease).
  - `main` only: `@semantic-release/changelog` (writes `CHANGELOG.md`) and `@semantic-release/git` (commits `package.json` and `CHANGELOG.md` as `chore(release): X.Y.Z [skip ci]`; the tag lands on that commit, so `@v1` source builds report the right version, since the CLI reads `package.json` at runtime: `src/cli/run.ts:74, :82`).
  - `beta` commits nothing back, so `beta` never edits those two files and the back-merge never conflicts on them.
- The workflow needs to know whether a release happened and its version (for the smoke check, `v1`, the site deploys and the back-merge). It gets them without a third-party action: `@semantic-release/exec`'s `successCmd` writes `published=true` and `version=<v>` to `$GITHUB_OUTPUT`.
- semantic-release, its plugins and the preset are `devDependencies` pinned in `pnpm-lock.yaml`, run with `pnpm exec semantic-release`.
- Check in the ticket: `@semantic-release/npm`'s support for npm trusted publishing (OIDC, no `NPM_TOKEN`) and the minimum version. If the plugin can't publish with OIDC, the publish step falls back to `npm publish --tag <channel>` from the workflow, with `@semantic-release/npm` set to `npmPublish: false` (it still writes the version into `package.json` before the build).

### `publish.yml`

- Runs on `push` to `main` and `beta`. Concurrency group per branch (`release-${{ github.ref_name }}`), never cancelled.
- **One release job**, in the `npm` GitHub environment (deployment branches: `main` and `beta` only; the npm trusted publisher is bound to it). Steps: checkout with full history, install, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, then semantic-release. The gates are the same on both branches.
- **Smoke check**, when a release was published: poll until `npm view archidocs@<version> version` answers (the registry lags), then `npx -y archidocs@<version> --version` must print `<version>`. A failure fails the run; the package stays published (npm can't unpublish safely), but `v1` isn't moved and no site deploys.
- **On `main` only**, after the smoke check:
  - move `v1` to the release tag (today's `major-tag` job, keyed on semantic-release's version instead of release-please's tag);
  - deploy the three sites to production (today's `docs` job, plus the two demos, which move here from `sites.yml`);
  - open a PR from `main` into `beta` titled `chore: merge main into beta after vX.Y.Z`, unless one is already open. It is a merge-commit PR (see Branch rules).
- The token: `@semantic-release/git` pushes to `main` past its ruleset, and the back-merge PR must trigger CI, so the job uses `secrets.RELEASE_TOKEN` (a GitHub App installation token or fine-grained PAT that the `main` ruleset lets bypass). `RELEASE_PLEASE_TOKEN` is retired. Without `RELEASE_TOKEN` the job fails with a message naming the secret, rather than falling back to `GITHUB_TOKEN` and failing later on the push.

### Branch rules (set by the maintainer, through the wizard)

- `beta`: the default branch. Pull requests required. Allowed merge methods: squash (feature PRs) **and** merge (the back-merge from `main`, which must keep `main`'s commits as ancestors or the next promotion conflicts). The PR template and `CONTRIBUTING.md` say feature PRs are squashed.
- `main`: pull requests required; allowed merge method: merge only. `RELEASE_TOKEN`'s identity may bypass, for the `chore(release)` commit and tags.

### CI and sites

- `ci.yml` and `sites.yml` run on `push` to `main` and `beta`, and on every PR as now.
- Each site's `wrangler.jsonc` gets an `env.staging`: a Worker named `<name>-staging` (`archidocs-docs-staging`, `archidocs-big-bank-staging`, `archidocs-kitchen-sink-staging`), the same `assets` block, one Custom Domain (`beta.archidocs.dev`, `beta.big-bank.archidocs.dev`, `beta.kitchen-sink.archidocs.dev`), `workers_dev: false`, `preview_urls: false`. Custom Domains get their own certificate, so the second-level demo hosts need no Advanced Certificate Manager.
- `website/wrangler.jsonc`'s `env.next` and every reference to `next.archidocs.dev` go. The maintainer deletes the `archidocs-docs-next` Worker in Cloudflare; nothing redirects.
- `sites.yml`: a push to `beta` deploys each site with `wrangler deploy --env staging`; a push to `main` deploys nothing (production moved to `publish.yml`); PRs keep their Previews unchanged. The header comment is rewritten to match.
- **Staging is public and `noindex`.** The staging deploy step adds `/*` → `X-Robots-Tag: noindex` to the built site's `_headers` (created or appended) before `wrangler deploy --env staging`. Production and PR Previews are unchanged (Cloudflare already marks `workers.dev` Previews `noindex`).
- **The staging docs say what they document.** The footer (`website/src/components/Footer.astro`) names the release from the root `package.json`, which on `beta` is the last stable version. The staging build sets an environment variable that the footer reads instead, so it says it documents the `beta` branch at `<short sha>`. Production and Preview footers don't change.

### Decisions taken here

Settled while writing the spec, after the grilling; challenge them before the tickets start.

1. **`beta` allows merge commits as well as squash.** The grilling said "squash only on `beta`", but the automatic back-merge from `main` has to be a merge commit. Rulesets can't allow a method per PR, so `beta` allows both and the docs say which is for what.
2. **The Action and GitLab template are tried with `version: beta`.** Both install `archidocs@$VERSION`, and npm resolves a dist-tag there, so no input changes.
3. **The docs' edit links point at `beta`** (`website/astro.config.mjs:41`, `edit/main/website/` → `edit/beta/website/`), since doc fixes are PRs into `beta`. Other `blob/main` links stay: they point at released code.
4. **`RELEASE_TOKEN` replaces `RELEASE_PLEASE_TOKEN`**, and is required.

## Testing Decisions

- These are workflow and config changes; there's no unit to test in `src/`. Each ticket proves itself by a run:
  - `release.config.js` is checked with `pnpm exec semantic-release --dry-run --no-ci` on both branches (with `GITHUB_REF_NAME` set), which prints the next version and the notes without publishing. The ticket's PR shows both outputs: a `-beta.N` version on `beta`, a stable one on `main`, and notes with today's sections.
  - `actionlint` passes on every workflow file touched (run with `pnpm dlx` or the Docker image; it isn't added as a dependency).
  - The first real beta publish is the end-to-end check: `npm view archidocs dist-tags` shows `beta: X.Y.Z-beta.1` and `latest` unchanged, the GitHub Release is marked as a prerelease, the smoke check passed, `v1` didn't move, and `beta.archidocs.dev` serves with `X-Robots-Tag: noindex`.
- `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm docs:test` pass at the end of every ticket. The docs ticket also passes `pnpm docs:build`.

## Cutover order

1. Merge [chalharb/archidocs#105](https://github.com/chalharb/archidocs/pull/105), so 1.3.2 is released by release-please and tagged `v1.3.2`. semantic-release then starts from that tag.
2. The tickets land on `main` as `ci:`/`docs:` PRs, which semantic-release won't release.
3. The maintainer runs the wizard: create `beta` from `main` and make it the default, the rulesets, the `npm` environment, the trusted-publisher binding, `RELEASE_TOKEN`. Then retarget open PRs (such as #106) to `beta`.
4. The first `feat`/`fix` merged into `beta` publishes `X.Y.Z-beta.1`.

## Documentation

| Where | What changes |
|---|---|
| `CONTRIBUTING.md` | Branch from and open PRs against `beta` (lines 62, 66). Feature PRs are squashed. A short "How releases work" section: `beta` publishes a beta on every push, a promotion PR (merge commit) into `main` releases it, hotfixes go to `main` and are merged back. How to try a candidate: `npx archidocs@beta`, `version: beta` in the Action or GitLab template, `beta.archidocs.dev`. Line 65's "Releases and `CHANGELOG.md` are made from them" stays true. |
| `website/src/content/docs/docs/help/upgrading.mdx` | Line 108 says release-please writes the Changelog: it becomes semantic-release. A "Try a beta" section for users: the three ways to install a beta, that betas can change before release, and where beta docs are. |
| `website/src/reference/text-sources.ts:100-101` | The fallback names `release-please-config.json` as the source; it becomes the semantic-release config. |
| `website/astro.config.mjs:41` | Edit links → `beta` (decision 3). |
| `website/wrangler.jsonc`, `examples/*/wrangler.jsonc`, `.github/workflows/*.yml` | Header comments describe the new deploys (no `next.archidocs.dev`, production from `publish.yml`, staging from `sites.yml`). |
| `.github/dependabot.yml` | Nothing: it sets no `target-branch`, so its PRs follow the default branch to `beta`. |
| `README.md` | Nothing: its only `main` (line 177) is the user's own branch in an example workflow. |

No glossary changes: the release process isn't part of the Archidocs domain, and "release" and "version" are already reserved there as words to avoid for domain terms.

## Out of Scope

- **Versioned docs** (`archidocs.dev/v1.3/`, pinned per-version sites). Raised and dropped in the grilling.
- **An `rc` stage.** semantic-release supports another prerelease branch later; not now.
- **Moving `v1` or any floating tag for betas**, and a `v1-beta` tag.
- **Automated e2e tests against the published package** beyond the install-and-`--version` smoke check.
- **Deleting `archidocs-docs-next` in Cloudflare**: the maintainer does it by hand.

## Build Tickets

| # | Ticket | Commit type | Blocked by |
|---|---|---|---|
| 01 | [Release both branches with semantic-release](issues/01-semantic-release.md) | `ci(release)` | #105 merged |
| 02 | [Staging sites on `beta.` hosts](issues/02-staging-sites.md) | `ci(sites)` | None |
| 03 | [Document the beta channel](issues/03-docs.md) | `docs` | 01, 02 |
| 04 | [Cutover wizard](issues/04-cutover-wizard.md) (`ready-for-human`) | `chore(scripts)` | 01, 02, 03 |

01 and 02 can run in parallel; both edit the `sites.yml` matrix, so whichever merges second rebases. All four land on `main`; none of them is released, because `ci`, `docs` and `chore` commits don't trigger a release.
