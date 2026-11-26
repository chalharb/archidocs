// Builds the docs site into a temp folder, or with E2E_DOCS_PREBUILT=1 takes
// the one `pnpm docs:build` already wrote to website/dist (CI's docs job builds
// it once for its build checks and this suite), and serves it as Workers
// static assets would: `/a/` serves `a/index.html`, `/a` redirects to `/a/`, and a
// missing path gets `404.html`.
import { execFileSync } from "node:child_process";
import { createReadStream, mkdtempSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DOCS_PORT } from "./port.ts";

const website = fileURLToPath(new URL("..", import.meta.url));
const prebuilt = process.env.E2E_DOCS_PREBUILT === "1";
const root = prebuilt ? join(website, "dist") : join(mkdtempSync(join(tmpdir(), "archidocs-docs-e2e-")), "dist");
if (!prebuilt) {
  execFileSync("pnpm", ["exec", "astro", "build"], { cwd: website, stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, ARCHIDOCS_DOCS_OUT_DIR: root } });
}

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

const isFile = async (file: string) => (await stat(file).catch(() => undefined))?.isFile() ?? false;

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://host").pathname);
  let file = resolve(root, normalize(path).replace(/^\/+/, ""));
  // Nothing outside the site: a path that climbs out of it is refused.
  if (file !== root && !file.startsWith(root + sep)) return void res.writeHead(400).end();
  if (!(await isFile(file))) {
    if (await isFile(join(file, "index.html"))) {
      if (!path.endsWith("/")) return void res.writeHead(307, { location: `${path}/` }).end();
      file = join(file, "index.html");
    } else {
      res.writeHead(404, { "content-type": types[".html"] });
      return void createReadStream(join(root, "404.html")).pipe(res);
    }
  }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(DOCS_PORT, "127.0.0.1", () => console.log(`Docs site on http://127.0.0.1:${DOCS_PORT}`));
