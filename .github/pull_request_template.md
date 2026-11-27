<!--
Title: a Conventional Commit, such as `feat(viewer): …` or `fix(cli): …`. The PR is squash-merged, so the title becomes the commit message and decides the release.
Target `beta`, even for an urgent fix: `main` takes no pull requests.
Every PR closes an issue: if this work has none, open one first and put its number below. "None" is not an answer there.
Delete these comments. A section with nothing to say keeps its heading, with "None." under it.
-->

Closes #

## What changed

<!-- What a user, or the code, does differently now. Behaviour first, then the main code changes. -->

## Why

<!-- The problem, or a link to the issue section that states it. -->

## Verification

<!-- What you ran or checked, and what it showed. Tick only what you did. -->

- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm test` pass
- [ ] Tests cover the change
- [ ] Generated files are regenerated and committed (`pnpm schemas`), if their sources changed
- [ ] Docs are updated, if behaviour users see changed
- [ ] Viewer or docs-site changes work by keyboard, and visual ones meet the contrast in [ACCESSIBILITY.md](https://github.com/chalharb/archidocs/blob/beta/ACCESSIBILITY.md)
- [ ] Checked by hand: <!-- what, and how -->

## For reviewers

<!-- Where to start, risky parts, anything that needs the maintainer (settings, secrets). -->
