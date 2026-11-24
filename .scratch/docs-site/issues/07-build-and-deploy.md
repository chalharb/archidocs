# How the site is built and deployed

Type: grilling
Status: open
Blocked by: –
Map: [Archidocs docs site](../map.md)

## Question

How does `website/` get from a commit to archidocs.dev? Decide: a new Vercel project rooted at `website/` (like `examples/*`), or a build in GitHub Actions that deploys the output; a preview deploy per PR; what triggers a production deploy (every push to main, or releases only, given the site is latest-only and documents the released CLI); and DNS. Facts: archidocs.dev's DNS is on Cloudflare, the root has **no A record** today (nothing is served), and the demo subdomains resolve to Cloudflare-proxied IPs.
