# 26: Publishing and CI integrations

Status: ready-for-agent
Assignee: Claude (ticket-26 session)
Blocked by: 25
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

Teams publish the site from CI with a few lines of config, and review PRs visually.

- A reusable GitHub Action: set up Node, restore `.archidocs/cache/` (keyed by `schemaVersion`), `check`, `build --out`, `upload-pages-artifact`, `deploy-pages`. It runs on default-branch pushes and tags, and a failed check publishes nothing.
- An includable GitLab CI template doing the same.
- `archidocs build --preview`: builds the PR head plus the base's latest Revision from `origin/<base>` (never fetched) and opens with Compare "base → PR".
- An opt-in `images` input that runs `export --all-saved --format svg` into `views/`.
- Docs for S3-style hosts, Netlify and Cloudflare Pages, with the recommended cache headers. Also a PR-comment recipe using `archidocs diff --format markdown`, posted by the CI user.

## Acceptance criteria

- [ ] An example workflow runs green against a fixture Workspace repo.
- [ ] A `--preview` site opens with Compare applied.
- [ ] Past Bundles are rebuilt from git when the cache is empty.
