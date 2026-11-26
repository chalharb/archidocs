# 09: Drop the `#` from viewer URLs

Status: wontfix

## Request

`http://127.0.0.1:4321/#/view/c2` → `http://127.0.0.1:4321/view/c2`.

## Decision: keep hash routing

Vite's history-mode support lives in Vite's own dev and preview servers, which send `index.html` for any unknown path. A built Archidocs site is plain files, so a path route depends on the host:

- GitHub Pages (what the Action deploys to) and GitLab Pages have no rewrites; the `404.html` workaround serves every deep link with a 404 status.
- S3-style buckets under a prefix need a CloudFront error-page rule.
- The PR preview artifact is unzipped and opened from `file://`, where path routing cannot work.
- The viewer is built once and shipped in the npm package with `base: "./"`, so it works under any prefix. With path routing, `/repo/view/c2/x` resolves `./assets/…` against the wrong folder, so the base would need to be known at build time or detected at runtime, and `archidocs build` doesn't know where the site will be deployed.

`docs/publishing.md` promises "any static host … under any base path, with no rewrites" (v1 spec story 123). One URL shape that works everywhere is worth more than a cleaner URL.

## If revisited

An opt-in `archidocs build --routing path` (writes `404.html` and a `<base>` tag) and path URLs in `archidocs dev`, with the hash staying the default and the viewer accepting both forms.
