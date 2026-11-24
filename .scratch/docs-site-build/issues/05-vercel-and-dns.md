# 05: Vercel project and DNS

Status: ready-for-human
Blocked by: None (can start immediately; production waits for 04)
Spec: [Archidocs docs site](../../docs-site/spec.md)

## What to build

Dashboard work in Vercel and Cloudflare ([build and deploy](../../docs-site/issues/07-build-and-deploy.md)).

1. **Root project:** in the Vercel project behind today's failing "Vercel" check, set Root Directory to `website/`, Framework Preset to Other, and turn on "Include files outside the root directory".
2. **Production on release only:** choose one:
   - an Ignored Build Step that builds production only for a `v*` tag, or
   - production builds off, with a deploy hook called from `publish.yml` after a release (that half is a small workflow change).

   Previews stay on for every PR and every push to `main`.
3. **Domains:** add `archidocs.dev` and `www.archidocs.dev` to the project, with `www` redirecting to the apex.
4. **DNS:** in Cloudflare, add the apex and `www` records Vercel asks for, **DNS-only (grey cloud)**. Leave the demo subdomains as they are.

## Acceptance criteria

- [ ] The "Vercel" PR check builds `website/` and passes on a PR after 04 merges.
- [ ] A push to `main` makes a preview, not a production deploy.
- [ ] A release makes a production deploy built from its tag.
- [ ] `https://archidocs.dev` serves the site over HTTPS, and `www` redirects to it.
- [ ] The memory note "Root Vercel check ignored" is deleted.
