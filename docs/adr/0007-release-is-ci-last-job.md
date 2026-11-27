# The release is CI's last job

`publish.yml` is a reusable workflow (`on: workflow_call`), and `ci.yml` calls it as its last job, which `needs` every other CI job and runs only for a push to `main` or `beta`. This replaces ADR 0003's trigger, `workflow_run` when CI completes, and keeps its gate: nothing releases unless all of CI passed on the pushed commit.

A `workflow_run` workflow runs as the default branch, `beta`. To release `main` the job set `GITHUB_REF` and `GITHUB_REF_NAME` to `main` itself, and npm then refused a provenance statement whose ref disagreed with the OIDC token, so stable releases were published with provenance turned off: 1.4.0 and 1.5.0 have no attestations, while their betas do. Called from CI, the release runs with the pushed branch's real ref and commit, so `github.ref_name` and `GITHUB_REF_NAME` are `main` or `beta` without an override, and every release, beta or stable, carries provenance (automatic with trusted publishing from a public repository).

ADR 0003 kept the release out of `ci.yml` because npm's Trusted Publisher named `publish.yml`. That no longer holds us back: a package can have up to ten Trusted Publishers, so the one for `ci.yml` is added beside it.

## Consequences

- npm's Trusted Publisher must name the calling workflow, `ci.yml`: with a reusable workflow, npm checks the caller's file name, not the file that runs `npm publish`. It names repository chalharb/archidocs and environment `npm`. Until one exists, every release job fails in semantic-release's verify step, before it tags or commits anything. The old one for `publish.yml` can be removed once a release has gone out through `ci.yml`.
- `id-token: write` is granted on both the calling job and the release job; the calling job grants the most any of `publish.yml`'s jobs needs, since a called workflow can't exceed its caller.
- The calling job passes only the secrets `publish.yml` reads (`RELEASE_TOKEN` and the two Cloudflare secrets), not `secrets: inherit`.
- A `needs` on a failed, cancelled or skipped job skips the release, as a failed CI run did before. Re-running failed CI jobs re-runs the release with them.
- The release, smoke check, `v1` tag and production deploys are now jobs of the CI run, so a failed release shows as a failed CI run on that commit.
- Each branch releases from its own copy of `publish.yml`: a change to it governs `main` once it is promoted, as before.
- The `npm` environment's branch rule now sees the real branch, `beta` or `main`.
- A push CI skips (only `docs/**`, `.claude/**` or `AGENTS.md`) still releases nothing.
- The checkout still takes the branch's tip and stops when the branch has moved past the commit CI tested, so a newer, untested commit is never released by an older run; the newer run releases both.
- The change can't run from a pull request: the first release from `beta` after it merges is its test, and the next promotion is the test for `main`.
