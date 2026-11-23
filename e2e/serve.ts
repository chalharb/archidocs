import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { archidocs } from "../test/support/cli.ts";
import { checkoutScenarioWorkspace, viewerWorkspace } from "../test/support/fixtures.ts";
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

const roots = new Map<string, string>([
  [SITES.landscape, await site(viewerWorkspace, ["c2", "shop:checkout-impact"])],
  [SITES.big, await site(syntheticWorkspace({ systems: 6, services: 20 }))],
  [SITES.checkout, await site(checkoutScenarioWorkspace)],
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
