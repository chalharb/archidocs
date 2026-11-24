# How the site is built and deployed

Type: grilling
Status: resolved
Blocked by: –
Map: [Archidocs docs site](../map.md)

## Question

How does `website/` get from a commit to archidocs.dev? Decide: a new Vercel project rooted at `website/` (like `examples/*`), or a build in GitHub Actions that deploys the output; a preview deploy per PR; what triggers a production deploy (every push to main, or releases only, given the site is latest-only and documents the released CLI); and DNS. Facts: archidocs.dev's DNS is on Cloudflare, the root has **no A record** today (nothing is served), and the demo subdomains resolve to Cloudflare-proxied IPs.

Also decide what label the site build stamps into exported diagram SVGs: `archidocs export` writes the checkout folder name and commit into each header today (e.g. `ticket-26-publishing-ci-065f52 · ce6dd3a`; see the landing page ticket).

## Answer

- **Vercel project:** repurpose the existing **root Vercel project**, the one behind the "Vercel" check that always fails because it uses the Next.js preset, as the docs site. Its root directory becomes `website/`, with a `website/vercel.json` following the `examples/*` pattern:
  - `framework: null`
  - `installCommand: cd .. && pnpm install --frozen-lockfile`
  - a build that runs from the repo root
  - output to `website/dist`

  This fixes the failing check instead of adding a fourth project.
- **Builds run on Vercel,** not in GitHub Actions. The build needs the whole repo, because it runs the repo's own CLI and code for diagrams, the MCP tool list, rules and schemas.
- **Production deploys only on a release.** The site is latest only and documents the released CLI, so unreleased flags on `main` must not reach production.
  - Every PR and every push to `main` gets a **preview** deployment.
  - Production builds from the **release tag** when release-please creates a release.
  - The mechanism is the build's call: Vercel's Ignored Build Step, or a deploy hook triggered from `publish.yml`.
- **No manual docs redeploy.** A docs fix waits for the next release. When a fix matters, cut a patch release; `docs:` commits are hidden from release-please's changelog.
- **DNS:**
  - `archidocs.dev` (apex) and `www` point to the docs project, with `www` redirecting to the apex.
  - Both records are **DNS-only (grey cloud)** on Cloudflare, so Vercel handles TLS and caching.
  - The demo subdomains stay as they are.
- **Diagram export label:** the site build stamps the **example name and release version** into exported SVG headers, e.g. `Big Bank · v1.2.0`, not the checkout folder and commit. This needs a label option on `archidocs export`, which becomes a build-effort ticket.

## Update (Nov 2026): Cloudflare Workers instead of Vercel

Vercel's free plan rate-limited PR deploys ("Deployment rate limited — retry in 24 hours"), and the account pays for Cloudflare, so hosting moved to **Cloudflare Workers (static assets)**. The answer above changes like this; the rest stands.

- **Worker, not a Vercel project:** `website/wrangler.jsonc` with `assets.directory: ./dist`, like `examples/*/wrangler.jsonc`. The root Vercel project is disconnected, not repurposed.
- **Builds run in GitHub Actions,** not on the host. They still need the whole repo. `wrangler` uploads the built `dist`. Workers Builds (Cloudflare's Git integration) was the alternative; Actions won because production must deploy from a release tag, which Workers Builds can't trigger, and because one workflow keeps the demos and the docs on the same path, with build logs next to CI.
- **Previews:** `wrangler preview --name pr-<n>` per PR (URL commented on the PR, deleted on close), and a Preview named `main` on each push to `main`.
- **Production:** a job in `publish.yml`, after release-please creates a release, checks out the tag and runs `wrangler deploy`.
- **DNS:** `archidocs.dev` is a Workers Custom Domain, so its record is proxied and Cloudflare handles TLS and caching. `www` gets a proxied placeholder record and a redirect rule to the apex.
