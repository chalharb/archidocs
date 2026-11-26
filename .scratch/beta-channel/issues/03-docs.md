# 03: Document the beta channel

Status: ready-for-agent
Blocked by: 01, 02
Spec: [Beta channel](../spec.md)

## What to build

Contributors and users learn the new flow from the repo and the site. PR title: `docs: ...`.

- **`CONTRIBUTING.md`**:
  - "Branch from `main`" (line 62) and "Open the pull request against `main`" (line 66) become `beta`. Feature PRs are squash-merged.
  - A short "How releases work" section: every push to `beta` publishes `X.Y.Z-beta.N` to the npm `beta` dist-tag and deploys `beta.archidocs.dev` and the `beta.` demos; a promotion PR from `beta` into `main`, merged with a merge commit, releases it to `latest`; urgent fixes are PRs into `main`, and after each stable release a bot PR merges `main` back into `beta` (merge commit, not squash).
  - How to try a candidate: `npx archidocs@beta`, `version: beta` in the GitHub Action or the GitLab template, and `beta.archidocs.dev`.
  - Line 65's "Releases and `CHANGELOG.md` are made from them" stays.
- **`website/src/content/docs/docs/help/upgrading.mdx`**: line 108 says release-please writes the Changelog; it becomes semantic-release (the type rules that follow don't change). Add a "Try a beta" section for users: the three ways to install one, that a beta can change or be withdrawn before its release, and that its docs are at `beta.archidocs.dev`.
- **`website/src/reference/text-sources.ts:100-101`**: the fallback source `release-please-config.json` becomes `release.config.mjs`.
- **`website/astro.config.mjs:41`**: `editLink.baseUrl` → `https://github.com/chalharb/archidocs/edit/beta/website/`. Other `blob/main` links stay (they point at released code).

The new text must pass the site's wording rules (`pnpm docs:test`).

## Tests

- `pnpm docs:test` and `pnpm docs:build` pass; the built "Upgrading" page has the "Try a beta" section and the edit link on any page points at `edit/beta/`.

## Acceptance criteria

- [ ] `grep -rn -i "release-please" --exclude-dir=node_modules --exclude-dir=.scratch --exclude=CHANGELOG.md .` finds nothing except ADR 0002.
- [ ] `CONTRIBUTING.md` names `beta` as the PR base and explains promotion, hotfixes and trying a beta.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm docs:test` and `pnpm docs:build` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
