import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "vite";
import { archidocs } from "../test/support/cli.ts";
import { checkoutScenarioWorkspace, decisionsWorkspace, historyAfter, historyBefore, viewerWorkspace } from "../test/support/fixtures.ts";
import { inWorkspace, scriptedRepo } from "../test/support/git-history.ts";
import { writeWorkspace, type Files } from "../test/support/workspace.ts";
import { syntheticWorkspace } from "../test/render/synthetic.ts";
import { PORT, SITES } from "./sites.ts";

// Build the viewer as `pnpm build` does, then each fixture site with the real CLI.
await build({ configFile: fileURLToPath(new URL("../viewer/vite.config.ts", import.meta.url)), logLevel: "warn" });

/** Builds a fixture site; `exports` are Views `archidocs export` also draws into the site's `expected/`, for the viewer's exports to match. */
async function site(files: Files, exports: string[] = []): Promise<string> {
  const { repoRoot } = await writeWorkspace(files);
  const run = async (...args: string[]) => {
    const { code, stdout, stderr } = await archidocs(repoRoot, ...args);
    if (code !== 0) throw new Error(`archidocs ${args.join(" ")} failed:\n${stdout}${stderr}`);
  };
  await run("build", "--out", "site");
  await mkdir(join(repoRoot, "site", "expected"));
  for (const view of exports) await run("export", view, "--out", join("site", "expected", `${view.replace(/[/:]/g, "-")}.svg`));
  return join(repoRoot, "site");
}

/** The history site: three Revisions, built keeping only the latest plus tags, so the first one's Bundle is dropped. */
async function historySite(): Promise<string> {
  const repo = await scriptedRepo();
  await repo.commit("First model", "2026-01-10T12:00:00Z", inWorkspace(viewerWorkspace));
  const legacy = await repo.commit("Add the Legacy shop", "2026-02-10T12:00:00Z", inWorkspace(historyBefore));
  await repo.commit("Add Wishlist, rename Web, retire Legacy", "2026-03-10T12:00:00Z", { ...inWorkspace(historyAfter), "archidocs/shop/legacy.yaml": null });
  repo.git("tag", "v1", legacy);
  const { code, stdout, stderr } = await archidocs(repo.repoRoot, "build", "--out", "site", "--keep", "1");
  if (code !== 0) throw new Error(`archidocs build failed:\n${stdout}${stderr}`);
  return join(repo.repoRoot, "site");
}

/** The preview site: `origin/main` at historyBefore, the PR head at historyAfter, built with `--preview`. */
async function previewSite(): Promise<string> {
  const repo = await scriptedRepo();
  await repo.commit("First model", "2026-01-10T12:00:00Z", inWorkspace(viewerWorkspace));
  const base = await repo.commit("Add the Legacy shop", "2026-02-10T12:00:00Z", inWorkspace(historyBefore));
  repo.git("update-ref", "refs/remotes/origin/main", base);
  repo.git("checkout", "--quiet", "-b", "pr");
  await repo.commit("Add Wishlist, rename Web, retire Legacy", "2026-03-10T12:00:00Z", { ...inWorkspace(historyAfter), "archidocs/shop/legacy.yaml": null });
  const { code, stdout, stderr } = await archidocs(repo.repoRoot, "build", "--out", "site", "--preview", "--base", "main");
  if (code !== 0) throw new Error(`archidocs build --preview failed:\n${stdout}${stderr}`);
  return join(repo.repoRoot, "site");
}

/** The Big Bank demo, built as `pnpm demo:big-bank` builds it. */
async function bigBankSite(): Promise<string> {
  const out = join(await mkdtemp(join(tmpdir(), "archidocs-e2e-big-bank-")), "site");
  await promisify(execFile)(process.execPath, [fileURLToPath(new URL("../examples/big-bank/build-demo.mjs", import.meta.url)), out]);
  return out;
}

const roots = new Map<string, string>([
  [SITES.landscape, await site(viewerWorkspace, ["c2", "shop:checkout-impact"])],
  [SITES.big, await site(syntheticWorkspace({ systems: 6, services: 20 }))],
  [SITES.checkout, await site(checkoutScenarioWorkspace)],
  [SITES.history, await historySite()],
  [SITES.preview, await previewSite()],
  [SITES.decisions, await site(decisionsWorkspace)],
  [SITES.bigBank, await bigBankSite()],
]);

const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

// A static host with no rewrites: a path either names a file under a site's sub-path or is a 404.
createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://host").pathname);
  for (const [prefix, root] of roots) {
    if (!path.startsWith(prefix)) continue;
    const rel = normalize(path.slice(prefix.length) || "index.html");
    if (rel.startsWith("..")) break;
    const file = join(root, rel);
    const info = await stat(file).catch(() => undefined);
    if (!info?.isFile()) break;
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
    return;
  }
  res.writeHead(404).end("Not found");
}).listen(PORT, "127.0.0.1", () => console.log(`Fixture sites on http://127.0.0.1:${PORT}`));
