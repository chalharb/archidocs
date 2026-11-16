// @ts-check
// A plain static file server, with no app logic, used by the end-to-end and pack tests.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/** @type {Record<string, string>} */
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

/**
 * Serves `dir` under the URL prefix `mount`. Unknown paths are 404s: there is no
 * single-page-app fallback, matching the weakest host a site may land on.
 * @param {{ dir: string, port?: number, mount?: string }} options
 * @returns {Promise<import("node:http").Server>}
 */
export function startStaticServer({ dir, port = 0, mount = "/" }) {
  const prefix = mount.endsWith("/") ? mount : `${mount}/`;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === "/__health") {
      res.writeHead(200).end("ok");
      return;
    }
    if (pathname === prefix.slice(0, -1) && prefix !== "/") {
      res.writeHead(301, { location: prefix }).end();
      return;
    }
    if (!pathname.startsWith(prefix)) {
      res.writeHead(404).end("not found");
      return;
    }
    let file = path.join(dir, pathname.slice(prefix.length));
    if (!file.startsWith(path.resolve(dir))) {
      res.writeHead(403).end("forbidden");
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      const body = await readFile(file);
      res
        .writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" })
        .end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, port, mount] = process.argv.slice(2);
  if (!dir || !port) throw new Error("usage: static-server.mjs <dir> <port> [mount]");
  await startStaticServer({ dir: path.resolve(dir), port: Number(port), mount });
}
