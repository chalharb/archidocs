# 02: Staging sites on `beta.` hosts

Status: ready-for-agent
Blocked by: None (can start immediately)
Spec: [Beta channel](../spec.md)

## What to build

Every push to `beta` deploys the docs and both demos to a persistent staging Worker on its own `beta.` host, public and `noindex`. `next.archidocs.dev` goes. PR title: `ci(sites): ...`.

- **`env.staging`** in each `wrangler.jsonc`, with the same `assets` block as the top level, `workers_dev: false`, `preview_urls: false`:
  - `website/wrangler.jsonc`: `name: "archidocs-docs-staging"`, Custom Domain `beta.archidocs.dev`.
  - `examples/big-bank/wrangler.jsonc`: `name: "archidocs-big-bank-staging"`, Custom Domain `beta.big-bank.archidocs.dev`.
  - `examples/kitchen-sink/wrangler.jsonc`: `name: "archidocs-kitchen-sink-staging"`, Custom Domain `beta.kitchen-sink.archidocs.dev`.
- **Remove `env.next`** from `website/wrangler.jsonc` and every reference to `next.archidocs.dev` and `--env next` in the repo (`grep -rn "next\.archidocs\|env next" --exclude-dir=node_modules --exclude-dir=.scratch .`). The Worker itself is deleted in Cloudflare by the maintainer.
- **`sites.yml`**:
  - `push.branches: [beta]` (a push to `main` deploys nothing here any more; production is in `publish.yml`, ticket 01).
  - The matrix's push command becomes `wrangler deploy --env staging` for all three sites (rename the matrix key from `main` to `staging`).
  - Before that deploy, append a `noindex` rule to the built site's `_headers` (create it if missing): a `/*` block with `X-Robots-Tag: noindex`. The asset folder is `website/dist` for docs and `examples/<site>/site` for the demos; add it to the matrix rather than parsing `wrangler.jsonc`. Check first whether a site already writes a `_headers` file, and append rather than overwrite.
  - PR Previews and their cleanup don't change.
  - Rewrite the header comment: PRs get Previews; a push to `beta` deploys all three to `beta.` hosts; production deploys only from a stable release, in `publish.yml`.
  - If ticket 01 merges first, rebase: both edit the matrix.
- **Staging footer.** `website/src/components/Footer.astro` names the release from the root `package.json`, which on `beta` is the last stable version. When the build has `ARCHIDOCS_DOCS_CHANNEL=beta` set, the footer instead says it documents the `beta` branch, with the short commit sha (the site already reads git at build time for "Last updated"). `sites.yml` sets that variable for the docs' staging build only. Production and Preview footers are byte-identical to today.
- Update the header comments of the three `wrangler.jsonc` files to match.

## Tests

- A test next to the footer's existing tests (`website/test/`), or a new one: with `ARCHIDOCS_DOCS_CHANNEL=beta` the footer names the `beta` branch and a sha; without it, it names the `package.json` version as before.
- `actionlint` passes on `sites.yml`.
- `pnpm exec wrangler deploy --env staging --dry-run --cwd <dir>` succeeds for each site after building it.

## Acceptance criteria

- [ ] Each `wrangler.jsonc` has an `env.staging` on its `beta.` Custom Domain; `env.next` is gone.
- [ ] `grep -rn "next\.archidocs" --exclude-dir=node_modules --exclude-dir=.scratch .` finds nothing.
- [ ] A push to `beta` deploys all three to staging with `X-Robots-Tag: noindex`; a push to `main` deploys nothing from `sites.yml`.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm docs:test` and `pnpm docs:build` pass.
- [ ] This ticket's `Status:` is set to `done` in the same PR.
