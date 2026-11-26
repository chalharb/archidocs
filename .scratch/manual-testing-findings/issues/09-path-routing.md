# 09: Drop the `#` from viewer URLs

Status: needs-triage

## Request

`http://127.0.0.1:4321/#/view/c2` → `http://127.0.0.1:4321/view/c2`.

## Why it's a hash today

A deliberate v1 choice: `.scratch/archidocs-v1/spec.md` story 123, "hash routing and relative URLs, so that the site works under any base path with no server rewrites". A built site is static files on any host (GitHub Pages, Cloudflare, S3, a CI artifact), and a path route 404s on reload or deep link unless the host rewrites to `index.html`.

## Options

- Keep the hash (wontfix).
- Path routing in `archidocs dev` only (it's our server, so it can rewrite) while built sites keep the hash. Two URL shapes for one link is a cost: copied dev links wouldn't work on the site.
- Path routing everywhere, plus a `404.html` copy of `index.html` and documented rewrite rules per host. Breaks every existing deep link unless the viewer also accepts the old `#/view/…` form and redirects.

If this goes ahead, record it as an ADR superseding story 123.
