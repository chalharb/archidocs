# 01: Release both branches with semantic-release

Status: ready-for-agent
Blocked by: [chalharb/archidocs#105](https://github.com/chalharb/archidocs/pull/105) merged (1.3.2 released and tagged `v1.3.2` by release-please)
Spec: [Beta channel](../spec.md)

## What to build

semantic-release replaces release-please and releases `main` (stable, `latest`) and `beta` (prerelease, `beta` dist-tag) from one `publish.yml`. PR title: `ci(release): ...`. It lands on `main` before the `beta` branch exists, so nothing is published by it.

- **Dependencies.** Add as `devDependencies`, pinned in `pnpm-lock.yaml`: `semantic-release`, `@semantic-release/changelog`, `@semantic-release/git`, `@semantic-release/exec`, `conventional-changelog-conventionalcommits`. (`commit-analyzer`, `release-notes-generator`, `npm` and `github` come with `semantic-release`.)
- **Config.** `release.config.mjs` at the root:
  - `branches: ["main", { name: "beta", prerelease: true }]`, `tagFormat: "v${version}"`.
  - `preset: "conventionalcommits"` for `commit-analyzer` and `release-notes-generator`, with `presetConfig.types` carrying today's sections from `release-please-config.json`: `feat` Features, `fix` Bug fixes, `perf` Performance, `revert` Reverts shown; `docs`, `style`, `refactor`, `test`, `ci`, `chore` hidden. Breaking changes (`!` or `BREAKING CHANGE`) bump major, as now.
  - Plugins by branch, read from `process.env.GITHUB_REF_NAME`: both get `commit-analyzer`, `release-notes-generator`, `npm`, `github`, and `exec` with a `successCmd` that appends `published=true` and `version=${nextRelease.version}` to `$GITHUB_OUTPUT`. `main` also gets `changelog` (`CHANGELOG.md`, keeping its existing title) and `git` (assets `package.json` and `CHANGELOG.md`, message `chore(release): ${nextRelease.version} [skip ci]`), ordered so `git` runs after `npm` has written the version.
  - **Trusted publishing.** First check `@semantic-release/npm`'s docs for npm OIDC trusted publishing (no `NPM_TOKEN`) and the minimum version; pin at least that. If it can't, set `npmPublish: false` and add a workflow step after semantic-release: `npm publish --tag <beta|latest> --provenance` when `published == 'true'`. Say which path was taken in the PR description.
- **Remove** `release-please-config.json`, `.release-please-manifest.json` and the `release-please` job.
- **`publish.yml`**, rewritten (keep the style of its header comment, describing the new flow):
  - `on: push: branches: [main, beta]`; `concurrency: { group: release-${{ github.ref_name }}, cancel-in-progress: false }`.
  - `release` job: `environment: npm`; permissions `contents: write`, `issues: write`, `pull-requests: write`, `id-token: write`. Checkout with `fetch-depth: 0` and `token: ${{ secrets.RELEASE_TOKEN }}`. A first step fails with `::error::` naming `RELEASE_TOKEN` when the secret is empty. Node 24, `npm install -g npm@latest` (trusted publishing needs ≥ 11.5.1), `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, then `pnpm exec semantic-release` with `GITHUB_TOKEN: ${{ secrets.RELEASE_TOKEN }}`. Outputs `published` and `version`.
  - `smoke` job (needs `release`, if `published == 'true'`): retry `npm view archidocs@$VERSION version` until it answers (up to ~5 minutes), then `npx -y archidocs@$VERSION --version` must print `$VERSION` exactly.
  - `major-tag` job (needs `smoke`, `main` only): today's job, moving `v<major>` to `v$VERSION`.
  - `docs` job (needs `smoke`, `main` only): today's job, checking out `v$VERSION`.
  - `demos` job (needs `smoke`, `main` only): a matrix over `big-bank` and `kitchen-sink`, checking out `v$VERSION`, building with `pnpm demo:<site>` and running `wrangler deploy --cwd examples/<site>`, as `sites.yml`'s deploy job does today. Skip with a notice when the Cloudflare secrets are missing, as `sites.yml` does.
  - `back-merge` job (needs `smoke`, `main` only): with `GH_TOKEN: ${{ secrets.RELEASE_TOKEN }}`, open a PR `--base beta --head main` titled `chore: merge main into beta after v$VERSION`, with a body saying to merge it with a merge commit; skip if `gh pr list --base beta --head main` finds one open; skip with a notice if the `beta` branch doesn't exist yet.
- **`sites.yml`**: a push to `main` no longer deploys the demos to production (the `main:` command in the matrix for `big-bank` and `kitchen-sink`); production moved to `publish.yml`. Leave the docs' `--env next` line for ticket 02. If ticket 02 merges first, rebase: both edit the matrix.
- **`ci.yml`**: `push.branches: [main, beta]`.

## Tests

- `GITHUB_REF_NAME=beta pnpm exec semantic-release --dry-run --no-ci --branches beta` and the same for `main`, run locally from a branch where both exist (or with `--repository-url` against a scratch fork). Paste both outputs in the PR: a `-beta.N` next version on `beta`, a stable one on `main`, and release notes with today's section titles.
- `actionlint` (`pnpm dlx actionlint` or `docker run rhysd/actionlint`) passes on `publish.yml`, `sites.yml` and `ci.yml`.

## Acceptance criteria

- [ ] No file mentions release-please except `CHANGELOG.md`'s history and the docs that ticket 03 rewrites.
- [ ] The dry runs show the right version and sections on both branches.
- [ ] On `beta`, nothing commits back, `v1` isn't moved and no production site deploys (by `if:` on each job).
- [ ] The release job fails early with a clear message when `RELEASE_TOKEN` is missing.
- [ ] `actionlint`, `pnpm test`, `pnpm typecheck` and `pnpm lint` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
