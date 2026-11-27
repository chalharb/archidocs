# Promote `beta` by fast-forwarding `main`

Every version commit is made on `beta`, and `main` only ever fast-forwards to a commit of `beta`. A beta release commits `package.json` with its version to `beta` and tags that commit. Promotion is the Promote workflow (`.github/workflows/promote.yml`), run by hand: it commits `package.json` with the stable version to `beta` as `chore(release): X.Y.Z`, then pushes that same commit to `main`. CI runs on `main`, and the stable release publishes from that commit, tags it and commits nothing. This replaces ADR 0002's promotion pull request merged with a merge commit, its urgent fixes made on `main` and merged back into `beta`, and its "only stable releases commit back".

Under ADR 0002 a stable release committed to `main`, so `main` and `beta` drifted apart at every release and two pull requests, each needing a merge commit, put them back together: the promotion and a bot's back-merge of `main` into `beta`. When the back-merge was squashed instead, merging it deleted `main`, because its head branch was `main` and the repo deletes merged branches. Betas committed nothing, so `package.json` on `beta` named the last stable version, not the beta that was published. With every version commit on `beta`, `main` is always an ancestor of `beta`, there is nothing to merge back, and `package.json` holds the released version at every beta and stable tag.

## Consequences

- Pull requests into `beta` are squash-only. `main` takes no pull requests: only the release token moves it, by the promotion's fast-forward, a plain push that fails unless it is one.
- An urgent fix goes through `beta` like any other change, and is promoted once its beta has published. If `beta` holds something that can't ship, it is reverted on `beta` first. `main` never gets a commit of its own.
- The stable version is the newest beta's with its `-beta.N` removed. Promote refuses when that version is already released, and when a commit after that beta would itself release, so what ships as stable is always what shipped as a beta.
- The promotion commit carries no `[skip ci]`: a push whose head commit says it runs no CI, and nothing would release.
- On `main`, semantic-release refuses to publish unless `package.json` already holds the version it computed, so a mismatch stops the release instead of committing a fix-up to `main`.
- Release notes live in GitHub Releases; there is no changelog file to keep in step.
- `workflow_dispatch` can't run from a pull request: the first promotion after this lands is its test.
