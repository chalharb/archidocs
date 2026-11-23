# Publishing the viewer

`archidocs build --out <dir>` writes a complete static site: the viewer, the latest Bundle (`workspace.bundle.json`), the past Bundles (`bundles/<sha>.json`) and the Revision index (`bundles/index.json`). Every URL in it is relative and the viewer uses hash routing, so any static host can serve it under any base path, with no rewrites.

Past Bundles come from git and a cache, never from the live site:

- The cache is `.archidocs/cache/` at the repo root. Keep it in your CI system's cache, keyed by the Bundle `schemaVersion` (`archidocs version --format json`).
- Any Revision missing from the cache is rebuilt from git, so a first deploy, a lost cache or a host move only costs build time. A new `schemaVersion` misses the cache and rebuilds every kept Revision.
- CI needs the full history: check out with `fetch-depth: 0` on GitHub, or `GIT_DEPTH: 0` on GitLab.

Publish on every push to the default branch and on every tag (tagged Revisions are always kept). Run `archidocs check` first: if it fails, publish nothing, so the last good site stays up.

## GitHub Pages

The reusable Action does all of this: set up Node, restore the cache, `check`, `build`, then `upload-pages-artifact` and `deploy-pages`. It only deploys on a push to the default branch or a tag.

```yaml
# .github/workflows/architecture.yml
name: Architecture
on:
  push:
    branches: [main]
    tags: ["*"]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  publish:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.archidocs.outputs.page-url }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: chalharb/archidocs@v1
        id: archidocs
        with:
          images: true # optional: also publish views/<view-id>.svg
```

Set the repository's Pages source to "GitHub Actions".

| Input | Default | What it does |
| --- | --- | --- |
| `working-directory` | `.` | Where to run Archidocs; the Workspace is found from here. |
| `out` | `_site` | The site folder, relative to `working-directory`. |
| `keep` | `200` | Past Bundles to keep, latest first, plus every tagged Revision; a count or `all`. |
| `images` | `false` | Also run `archidocs export --all-saved --format svg` into the site's `views/`. |
| `preview` | `false` | Build a PR preview and upload it as a workflow artifact instead of deploying. |
| `base` | the PR's base branch | The preview's base branch, read from `origin/<base>`. |
| `deploy` | `true` | Deploy to GitHub Pages (only ever on a default-branch push or a tag). |
| `version` | the Action's own | The archidocs npm version to run. |
| `node-version` | `24` | The Node.js version to set up. |

Its outputs are `site` (the site folder's path) and `page-url`.

### Saved View images

With `images: true`, every Saved View is rendered to `views/<view-id>.svg` (a `:` or `/` in the id becomes `-`, so `shop:overview` is `views/shop-overview.svg`). The URLs are stable, so wikis and READMEs always show the latest diagram:

```markdown
![Shop overview](https://<owner>.github.io/<repo>/views/shop-overview.svg)
```

Images are only rendered for the latest Revision, never per Revision.

## GitLab Pages

Include the template, which adds a `pages` job on default-branch pushes and tags, and an `archidocs-preview` job on merge requests:

```yaml
# .gitlab-ci.yml
include:
  - remote: https://raw.githubusercontent.com/chalharb/archidocs/v1/templates/gitlab/archidocs.gitlab-ci.yml
    inputs:
      images: true
```

Its inputs are `working-directory`, `keep`, `images`, `preview` (the merge request job, on by default), `version` (the archidocs npm version) and `image` (the Node.js image, `node:24`). The cache key names the Bundle `schemaVersion`, so a template for a new schema starts a new cache.

## PR previews

`archidocs build --preview` builds a site that holds two Bundles: the PR head (the checkout as it is) and the base branch's latest Revision. The site opens with Compare "base → PR" applied on the C2 Landscape.

```sh
archidocs build --preview --base main --out preview
```

- The base is read from `origin/<base>` in the checkout. Archidocs never fetches it, so fetch it first; with GitHub's `actions/checkout` and `fetch-depth: 0` it is already there.
- Without `--base`, the base is the branch `origin/HEAD` names, else `main`.
- A base with no Workspace yet Compares against an empty Model, so everything in the PR shows as added.

Archidocs hosts nothing. On GitHub the Action uploads the preview as the `archidocs-preview` workflow artifact:

```yaml
# .github/workflows/architecture-preview.yml
name: Architecture preview
on: pull_request

permissions:
  contents: read

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: chalharb/archidocs@v1
        id: archidocs
        with:
          preview: true
```

GitHub Pages can't host a site per PR. To browse previews, deploy the `site` output somewhere that can:

- **Netlify:** `netlify deploy --dir "$SITE" --alias "pr-$PR_NUMBER"`.
- **Cloudflare Pages:** `wrangler pages deploy "$SITE" --project-name <project> --branch "pr-$PR_NUMBER"`.
- **S3-style bucket:** sync it under a prefix, such as `s3://<bucket>/pr/<n>/`. The site works under any base path.

On GitLab, the `archidocs-preview` job keeps the preview as a merge request artifact ("Archidocs preview").

## PR comment recipe

`archidocs diff --format markdown` writes the Changes between two points as Markdown. Archidocs posts no comments; post it as your CI user. On GitHub, add this job to the preview workflow (it needs `pull-requests: write`):

```yaml
  comment:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm install --global archidocs
      - name: Comment the architecture changes
        env:
          GH_TOKEN: ${{ github.token }}
          BASE: ${{ github.base_ref }}
          PR: ${{ github.event.pull_request.number }}
        run: |
          {
            echo "### Architecture changes"
            archidocs diff "origin/$BASE" HEAD --format markdown
          } > architecture.md
          # Edit the comment this job posted before, or post one.
          gh pr comment "$PR" --body-file architecture.md --edit-last --create-if-none
```

Run it on `pull_request`, not `pull_request_target`, so a PR from a fork never runs with a write token. On GitLab, post `architecture.md` with the Notes API and a project access token.

## Other static hosts

For S3-style buckets, Netlify, Cloudflare Pages and similar, run `archidocs check` and `archidocs build --out site` in CI, restoring and saving `.archidocs/cache/` around them, then upload the folder.

Recommended cache headers:

| Path | `Cache-Control` |
| --- | --- |
| `bundles/<sha>.json` | `public, max-age=31536000, immutable` (it never changes once published) |
| `bundles/index.json` | `no-cache` |
| `workspace.bundle.json` | `no-cache` |
| `index.html` | `no-cache` |

No headers are required. MCP's `--bundle <url>` re-checks `index.json` at most every 60 seconds, with `If-None-Match` or `If-Modified-Since` when the host gives an ETag or `Last-Modified`.

### S3-style buckets

Upload the past Bundles first and the index last, so a reader never sees an index naming a Bundle that isn't there yet:

```sh
aws s3 sync site/bundles/ "s3://$BUCKET/bundles/" --delete --exclude index.json \
  --cache-control "public, max-age=31536000, immutable"
aws s3 sync site/ "s3://$BUCKET/" --delete --exclude "bundles/*" --exclude index.html --exclude workspace.bundle.json
aws s3 cp site/workspace.bundle.json "s3://$BUCKET/" --cache-control no-cache
aws s3 cp site/index.html "s3://$BUCKET/" --cache-control no-cache
aws s3 cp site/bundles/index.json "s3://$BUCKET/bundles/" --cache-control no-cache
```

### Netlify

Netlify can apply more than one matching rule in `_headers`, so give each Bundle a rule of its own rather than a `/bundles/*` rule that `index.json` also matches. Write the file into the site before deploying:

```sh
{
  printf '/index.html\n  Cache-Control: no-cache\n'
  printf '/workspace.bundle.json\n  Cache-Control: no-cache\n'
  printf '/bundles/index.json\n  Cache-Control: no-cache\n'
  for f in site/bundles/*.json; do
    [ "$(basename "$f")" = index.json ] && continue
    printf '/bundles/%s\n  Cache-Control: public, max-age=31536000, immutable\n' "$(basename "$f")"
  done
} > site/_headers
netlify deploy --prod --dir site
```

### Cloudflare Pages

Cloudflare Pages joins the values of matching rules and allows 100 rules, so detach the general rule's header for the index with `!`:

```sh
cat > site/_headers <<'EOF'
/bundles/*
  Cache-Control: public, max-age=31536000, immutable
/bundles/index.json
  ! Cache-Control
  Cache-Control: no-cache
/workspace.bundle.json
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
EOF
wrangler pages deploy site --project-name <project>
```
