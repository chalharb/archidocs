# Viewer build and publishing

Type: grilling
Status: resolved
Assignee: Logan Harber
Blocked by: –
Map: [Archidocs v1](../map.md)
Context: [History UX](15-history-ux.md) fixes the files CI publishes beside the viewer: `bundles/<sha>.json` for every Revision, plus `bundles/index.json` (the timeline, with each Revision's changed ids). The viewer reads them for `at` and Compare, and MCP reads them in `--bundle <url>` mode. [Viewer UX](14-viewer-ux.md) keeps the whole screen in the URL. [Workspace aggregation](07-workspace-aggregation.md) makes a Workspace one repo whose CI runs `archidocs check`.
Context: [Saved View export and selectors](18-saved-view-export.md) keeps `archidocs build` bundle-only and adds `archidocs export <view-id> --format svg|png` plus `--all-saved --out <dir>`; whether the published site includes rendered Saved View images is this ticket's.

## Question

How is the static viewer built from a Workspace and published from CI? Settle:
- the command: an `archidocs build` that outputs one folder (viewer assets, `workspace.bundle.json`, `bundles/`), and how it gets past Bundles already published (fetch the previous `index.json` from the published site, or a CI cache);
- which static hosts are documented (GitHub Pages, GitLab Pages, any S3-style bucket) and what is shipped for them (a reusable GitHub Action, a GitLab template, or docs only);
- how URLs work on a static host with no server rewrites (hash routing or a base path), so Copy link and back and forward keep working;
- whether PR branches get a preview viewer, and if so whether PR previews can Compare against the default branch's latest Revision;
- whether published Bundles carry an ETag or other cache headers that `--bundle <url>` relies on.

## Answer

Settled in a grilling session on 2026-11-22. Terms follow [GLOSSARY.md](../../../GLOSSARY.md); no terms changed. This amends the "all are kept" retention of [History UX](15-history-ux.md).

**`archidocs build`**
- `archidocs build --out <dir>` writes the whole static site. The viewer assets ship prebuilt in the npm package and are copied as they are. The folder holds:
  - `index.html` and `assets/`;
  - `bundles/<sha>.json` for every kept Revision, and `bundles/index.json`;
  - `workspace.bundle.json` at the root: the latest Bundle, for simple consumers.
- `--bundle-only` writes just `workspace.bundle.json`.
- MCP's `--bundle <url>` takes either the site root (it reads `bundles/index.json`, so `at`, `get_changes` and `list_history` work) or a lone Bundle file (no history).
- Images are never rendered by `build` (see "Saved View images").

**Getting past Bundles already published**
- Git is the source of truth. CI restores `.archidocs/cache/` from the CI system's cache, keyed by `schemaVersion`, and rebuilds any missing Revision from git (a full clone), as `archidocs history build` does.
- Nothing is fetched from the published site, so a first deploy, a lost cache or a host move costs only build time.
- A `schemaVersion` bump misses the cache and rebuilds every kept Revision, matching the checkout rule in [History UX](15-history-ux.md).

**Retention**
- Full Bundles are kept for the latest 200 Revisions (`--keep <n>`) plus every tagged Revision. `--keep all` keeps every one, for hosts with no size cap such as S3.
- This keeps the site under the roughly 1 GB cap of GitHub Pages and GitLab.com Pages; at 1–2 MB per Bundle, keeping all would pass it within about a year on a busy Workspace.
- `bundles/index.json` still lists every Revision with its changed ids, so the timeline, `list_history` and the Element History tab cover all of history. An entry whose Bundle was dropped carries `bundle: false`.
- `at` or Compare on such a Revision, in the viewer or MCP, returns `history_unavailable`, pointing to a checkout or `archidocs diff`.

**Hosts and what ships**
- **GitHub Pages:** a reusable GitHub Action: set up Node, restore the cache, `archidocs check`, `archidocs build`, then `upload-pages-artifact` and `deploy-pages`.
- **GitLab Pages:** an includable CI template doing the same.
- **Any S3-style bucket, Netlify, Cloudflare Pages and similar:** docs only (`build`, then a sync), with the recommended headers below.

**When it publishes**
- On every push to the default branch, and on tags (so tagged Revisions are kept), gated on `archidocs check`. A failed check publishes nothing and the last good site stays up.

**URLs on a static host**
- Hash routing (`…/#/view/<id>?lens=…&at=…&vs=…`), so no server rewrites are needed and Copy link, back and forward keep working as [Viewer UX](14-viewer-ux.md) requires.
- Every asset and Bundle URL is relative to `index.html`, so the site works under any base path (such as `/<repo>/` on Pages) with no base-path option.

**Caching**
- `bundles/<sha>.json` is immutable once published; readers cache it indefinitely. `bundles/index.json` and `workspace.bundle.json` change.
- MCP in `--bundle <url>` mode re-checks `index.json` at most every 60 s, sending `If-None-Match` / `If-Modified-Since` when the host gave an ETag or Last-Modified, and plainly refetching otherwise. No headers are required; Pages hosts set ETags themselves.
- Docs recommend, where the host allows: `Cache-Control: public, max-age=31536000, immutable` on `bundles/<sha>.json`, and `no-cache` on `index.json` and `workspace.bundle.json`.

**PR previews**
- `archidocs build --preview` builds a site with two Bundles, the PR head and the base branch's latest Revision (read from `origin/<base>` in the checkout, never fetched), and opens with Compare "base → PR" applied.
- Hosting is the CI user's: the Action uploads the folder as a workflow artifact, and docs show Netlify, Cloudflare Pages or an S3 prefix (`pr/<n>/`). GitHub Pages can't host per-PR sites.
- This sits beside the `archidocs diff --format markdown` PR comment from [History UX](15-history-ux.md). Archidocs ships no preview hosting and posts no PR comments.

**Saved View images**
- Not part of `build`, as [Saved View export and selectors](18-saved-view-export.md) settled.
- The Action and the GitLab template take an opt-in `images` input (off by default) that also runs `archidocs export --all-saved --format svg --out <site>/views/`, giving stable `views/<view-id>.svg` URLs for wikis and READMEs.
- Latest Revision only; images are never kept per Revision.
