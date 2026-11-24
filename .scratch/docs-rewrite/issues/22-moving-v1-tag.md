# 22: A moving `v1` tag for the Action and the GitLab template

Status: done
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

The docs tell readers to use `chalharb/archidocs@v1`, and to include the GitLab template from `…/archidocs/v1/templates/gitlab/archidocs.gitlab-ci.yml`. The repo has the tags `v1.0.0`, `v1.1.0` and `v1.2.0` and no `v1`, so neither reference resolves and a workflow copied from the docs fails. The maintainer chose a moving `v1` tag ([ticket 19](19-upgrading-and-versioning.md)).

The references are in:

- `examples/tutorial/.github/workflows/architecture.yml`, shown in the tutorial and `guides/publish/github-pages`
- `guides/publish/pr-previews`, `guides/publish/saved-view-images` and `guides/publish/gitlab-pages`
- `README.md`

**Build:**

- **Release step:** in `.github/workflows/publish.yml`, after release-please creates `vX.Y.Z`, move the `vX` tag to the same commit and push it with force. Only the major tag moves; no `vX.Y` tag.
- **First tag:** the next release creates `v1`. Until then the docs are wrong, so the maintainer creates it once by hand at `v1.2.0`. An agent doesn't push tags to this repo without being asked.
- **Check:** a test that every `chalharb/archidocs@<ref>` and every raw template URL on a hand-written page, in the README and in `examples/` uses the major of the version in `package.json`.

The GitLab template runs the npm package, so `v1` there only picks the template file.

## Acceptance criteria

- [x] A `v1` tag exists and points at the latest 1.x release.
- [ ] A release moves `v1`, shown by a dry run or the next release.
- [ ] `uses: chalharb/archidocs@v1` resolves in a workflow. (The tag and its `action.yml` exist; no workflow has run it yet.)
- [x] The raw GitLab template URL returns the file.
- [x] The reference check runs in `pnpm docs:test` and fails on `@v2` while `package.json` is 1.x.

## Comments

### Build notes (2026-11-24)

- **First tag:** the maintainer asked for it, so `v1` was created at `v1.2.0` (`e153f59`) and pushed. The raw template URL and `action.yml` at `v1` both return 200. The Action wasn't run from a workflow at `@v1`; the tag holds the same commit as `v1.2.0`.
- **Release step:** a `major-tag` job in `.github/workflows/publish.yml` moves the major tag after `publish` passes, so `@v1` never points at a release whose tests failed. It takes the major from the release tag (`v1.2.0` → `v1`). It hasn't run yet: the next release is its first run, which is why the second criterion is unchecked.
- **Check:** `website/test/release-refs.test.ts` reads the hand-written pages, the intros, the README and the examples' YAML. Changing the README to `@v2` fails it.
- **No docs page changed:** every reference already said `v1`.
