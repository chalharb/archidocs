# A beta branch, released with semantic-release

Unreleased work lands on a long-lived `beta` branch (the repo's default branch), and every push to it publishes a prerelease, `X.Y.Z-beta.N`, to the npm `beta` dist-tag, with a git tag and a GitHub Release marked as a prerelease. So a candidate can be tried with `npx archidocs@beta` or the Action's `version:` input before it reaches anyone on `latest`. `main` holds only what is released: `beta` reaches it through a promotion PR merged with a merge commit (feature PRs into `beta` stay squash-merged), and urgent fixes go to `main` directly and are merged back into `beta`.

Both channels are released by semantic-release, which replaced release-please. release-please supports prereleases, but only through a release PR per beta, a separate config per branch, and a manual `Release-As` footer at every promotion (without it, an open bug turns `1.4.0-beta.3` into `1.5.0-beta.3`, googleapis/release-please#2515). Its CHANGELOG and manifest also conflict at every merge after a hotfix. semantic-release publishes on every push and treats a branch named `beta` as a prerelease branch by default. We gave up release-please's release PR, the review step before a stable release; the `beta`→`main` promotion PR now does that job.

## Consequences

- The branch is named `beta`, not `next`: in semantic-release's defaults `next` is a *stable* release line on the `next` channel, so `beta` needs no override and the branch, version suffix and dist-tag share one name.
- A prerelease never moves the floating `v1` tag and never deploys production sites. Every push to `beta` deploys each site (docs and demos) to a `staging` Wrangler environment, a persistent Worker on its own `beta.` host (`beta.archidocs.dev`, `beta.big-bank.archidocs.dev`, `beta.kitchen-sink.archidocs.dev`), served with `noindex`. Production deploys only on a stable release. This replaced `next.archidocs.dev`.
- Only stable releases commit back (`package.json` and `CHANGELOG.md`), so `@v1` source builds report the right version and `beta` never conflicts with `main` on those files.
- Publishing runs through a GitHub environment that only `main` and `beta` may deploy to, and the npm trusted publisher is bound to it.
