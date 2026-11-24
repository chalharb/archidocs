# 05: Cloudflare Workers and DNS

Status: ready-for-human
Blocked by: None (can start immediately; production waits for 04)
Spec: [Archidocs docs site](../../docs-site/spec.md)

## What to build

Dashboard work in Cloudflare, GitHub and Vercel ([build and deploy](../../docs-site/issues/07-build-and-deploy.md)). Hosting moved from Vercel to Cloudflare Workers in Nov 2026; the demos already deploy through `.github/workflows/demos.yml`.

1. **(Done 2026-11-23)** **API token:** in Cloudflare, **My Profile › API Tokens › Create Token** (Custom token) with:
   - Account › **Workers Scripts** › Edit
   - Zone › **Workers Routes** › Edit, for `archidocs.dev`
   - Zone › **DNS** › Edit, for `archidocs.dev` (Custom Domains create their records)
   - Account › **Account Settings** › Read (lets wrangler resolve the account)
2. **(Done 2026-11-23)** **Repo secrets:** add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (Workers & Pages overview, right sidebar) to the GitHub repo's Actions secrets.
3. **workers.dev subdomain:** make sure the account has one (Workers & Pages › Settings), since Previews are served on it.
4. **(Done 2026-11-23, PR #48)** **Demo cutover:** delete the existing DNS records for `big-bank` and `kitchen-sink` (they point at Vercel; a Custom Domain can't be created over an existing CNAME), then let the next push to `main` (or a re-run of the Demos workflow) deploy the Workers and create the Custom Domains.
5. **Docs domain:** after 04 merges, the first release deploy creates the `archidocs.dev` and `www` Custom Domains from `website/wrangler.jsonc`. Add a redirect rule `www.archidocs.dev/*` → `https://archidocs.dev/${1}` (301).
6. **(Done)** **Remove the Vercel config:** once both demos serve from Workers, delete `examples/*/vercel.json` and the `.vercel/` line in `.gitignore` (agent work, one small PR). They stay until then so Vercel remains a fallback.
7. **Disconnect Vercel:** for each project (`archidocs`, `archidocs-big-bank`, `archidocs-kitchen-sink`): Project › Settings › Git › **Disconnect**, then remove its domains under Settings › Domains, then Settings › General › **Delete Project**. Uninstall the Vercel GitHub app from the repo if nothing else uses it.

## Acceptance criteria

- [x] The Demos workflow deploys both demos on a push to `main` and comments Preview URLs on a PR.
- [x] `https://big-bank.archidocs.dev` and `https://kitchen-sink.archidocs.dev` are served by their Workers.
- [ ] No `vercel.json` is left in the repo, and no "Vercel" checks appear on new PRs.
- [ ] A release makes a production deploy of the docs built from its tag; a push to `main` only updates the `main` Preview.
- [ ] `https://archidocs.dev` serves the site over HTTPS, and `www` redirects to it.
- [ ] The memory note "Root Vercel check ignored" is deleted.
