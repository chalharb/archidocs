# Release runs only after CI passes

`publish.yml` no longer checks the code itself. It is triggered by `workflow_run` when the CI workflow completes successfully for a push to `main` or `beta`, checks out the commit CI tested (`head_sha`), builds it and runs semantic-release. Before, Release ran on every push alongside CI and re-ran lint, typecheck, unit tests and the build as its own gate. That gate was both slower (about a minute per release spent repeating CI) and weaker (it skipped the e2e, docs, walkthrough and Action jobs, so a release could publish from a commit whose CI was red).

We kept the release in its own `publish.yml` rather than folding it into `ci.yml` as a final job: npm's Trusted Publisher for archidocs names the workflow file `publish.yml`, so moving publishing to another file would mean reconfiguring it on npmjs.com.

Production sites now deploy on every push to `main` that passes CI, not only when a release publishes, so a docs fix on `main` goes live without waiting for a release. When a release does publish, the deploy still waits for the smoke check. This replaces the line in ADR 0002 that production deploys only on a stable release; PRs keep their Worker Previews and `beta` keeps its staging Workers.

## Consequences

- A `workflow_run` workflow always runs from the default branch's copy of the file (`beta`), and `github.ref` is always `refs/heads/beta`, even when it releases `main`. Every branch check in `publish.yml`, and its concurrency group, read `github.event.workflow_run.head_branch` instead of `github.ref_name`.
- A change to `publish.yml` governs `main`'s releases only once it is on `beta`; promotion carries it to `main` as usual.
- If a newer commit lands before CI finishes, semantic-release finds the branch behind the remote and skips; the newer commit's CI run releases both.
- The `npm` environment's branch rule sees `beta` for both channels, so it no longer tells them apart; the `branches: [main, beta]` filter on the trigger is what limits publishing to those two branches.
- A push that CI ignores (only `docs/**`, `.scratch/**` and the like) triggers no release. Such commits never call for one, and the next release includes them.
- When a release publishes, production deploys from its tag, so the sites carry the release commit's version; otherwise from the commit CI tested (`head_sha`).
- The trigger can't be exercised from a PR, since `workflow_run` runs from the default branch: the first push to `beta` after the change is its test.
