import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { archidocs } from "../test/support/cli.ts";
import { landscapeWorkspace } from "../test/support/fixtures.ts";
import { writeWorkspace, type Files } from "../test/support/workspace.ts";
import { syntheticWorkspace } from "../test/render/synthetic.ts";
import { PORT, SITES } from "./sites.ts";

// Build the viewer as `pnpm build` does, then each fixture site with the real CLI.
await build({ configFile: fileURLToPath(new URL("../viewer/vite.config.ts", import.meta.url)), logLevel: "warn" });

async function site(files: Files): Promise<string> {
  const { repoRoot } = await writeWorkspace(files);
  const { code, stdout, stderr } = await archidocs(repoRoot, "build", "--out", "site");
  if (code !== 0) throw new Error(`archidocs build failed:\n${stdout}${stderr}`);
  return join(repoRoot, "site");
}

const roots = new Map<string, string>([
  [SITES.landscape, await site(landscapeWorkspace)],
  [SITES.big, await site(syntheticWorkspace({ systems: 6, services: 20 }))],
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
