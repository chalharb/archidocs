# 04: Cutover wizard

Status: ready-for-human
Blocked by: 01, 02, 03
Spec: [Beta channel](../spec.md)

## What to build

A `/wizard` script for the one-time steps only the maintainer can take, run after tickets 01–03 have merged to `main`. An agent writes the script; the maintainer runs it. PR title: `chore(scripts): ...`.

Steps, in this order (each opens the right page or runs the `gh` command, and checks the result before going on):

1. Confirm `v1.3.2` exists (`git ls-remote --tags origin v1.3.2`) and that no release-please PR is open.
2. Create `beta` from `main` and push it (`git push origin main:refs/heads/beta`).
3. Make `beta` the default branch (`gh repo edit --default-branch beta`).
4. Rulesets (Settings → Rules, or `gh api`):
   - `beta`: pull request required; allowed merge methods squash and merge.
   - `main`: edit the existing `main` ruleset (it has no bypass actors and requires linear history today). Turn **off** "Require linear history", which blocks the merge commit every promotion needs; set the allowed merge method to merge only; add the identity behind `RELEASE_TOKEN` as a bypass actor (the **Repository admin** role for a PAT, or the App itself), so the `chore(release)` commit can be pushed.
   - Repo settings: allow merge commits (currently off) as well as squash.
5. Create the `npm` environment with deployment branches `main` and `beta` only.
6. On npmjs.com, archidocs → Settings → Trusted Publisher: set the environment to `npm` on the existing GitHub Actions publisher (repository `chalharb/archidocs`, workflow `publish.yml`).
7. `RELEASE_TOKEN`: create a GitHub App installation token or a fine-grained PAT with contents and pull-requests write on this repo; store it as a repository secret (`gh secret set RELEASE_TOKEN`). Delete `RELEASE_PLEASE_TOKEN`.
8. In Cloudflare, delete the `archidocs-docs-next` Worker (its `next.archidocs.dev` Custom Domain goes with it) and the leftover advanced certificate for that host, if one is listed under SSL/TLS → Edge Certificates.
9. Retarget open PRs from `main` to `beta` (`gh pr list --base main` then `gh pr edit <n> --base beta`).

## Acceptance criteria

- [ ] The script runs end to end and each step checks its own result.
- [ ] After running it: `beta` is the default branch, both rulesets and the `npm` environment exist, `RELEASE_TOKEN` is set and `RELEASE_PLEASE_TOKEN` is gone.
- [ ] The first `feat` or `fix` merged into `beta` publishes `X.Y.Z-beta.1`: `npm view archidocs dist-tags` shows it under `beta` with `latest` unchanged, its GitHub Release is marked as a prerelease, `v1` didn't move, and `curl -sI https://beta.archidocs.dev` shows `x-robots-tag: noindex`.
- [ ] This ticket's `Status:` is set to `done` in the same PR as the script, and the post-run checks are appended under `## Comments`.
