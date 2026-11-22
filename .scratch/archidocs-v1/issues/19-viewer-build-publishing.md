# Viewer build and publishing

Type: grilling
Status: open
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
