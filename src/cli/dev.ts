import { watch, type FSWatcher } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize, sep } from "node:path";
import type { Issue } from "../core/index.ts";
import { formatText } from "./format.ts";
import { isWorkspaceFile, type Checkout } from "../workspace/index.ts";
import { INDEX_PATH, INDEX_VERSION, LATEST_BUNDLE_PATH, serializeBundle, serializeIndex, serializeSiteFile, SITE_FILE_PATH } from "../revisions/index.ts";

export const DEFAULT_DEV_PORT = 4321;

/** The path the page listens on for reloads; under `__archidocs/` so it can't clash with a site file. */
const EVENTS = "/__archidocs/events";

/**
 * How long the Workspace must be quiet before it is read again, so an agent's
 * run of MCP edits, seconds apart, makes one new Bundle, not one per edit.
 */
export const QUIET_MS = 1000;
/** The longest a burst of changes holds a rebuild back, so a long agent session still shows progress. */
export const MAX_WAIT_MS = 5000;

export interface DevOptions {
  /** The Workspace to serve. Its root is watched for changes, and its name is how the viewer's exports name the Workspace, as `site.json` does in a built site. */
  checkout: Checkout;
  /** The prebuilt viewer to serve. */
  viewerDir: string;
  host?: string;
  /** 0 picks a free port. */
  port?: number;
  /** Called after each load with the Workspace's issues; `kept` when errors kept the last good Bundle. */
  onLoad?: (result: { issues: Issue[]; kept: boolean; first: boolean }) => void;
}

export interface DevServer {
  url: string;
  /** Re-reads the Workspace now, as a file change would. */
  reload(): Promise<void>;
  close(): Promise<void>;
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".png": "image/png",
};

/**
 * The page's side of dev mode: on a new Bundle, have the viewer swap it in
 * place (keeping the camera, selection and open boxes), or reload the page
 * when it can't (hash routing keeps the place); and show the Workspace's
 * errors in a banner while they last.
 */
const CLIENT = `<script>
(() => {
  let banner;
  const events = new EventSource(".${EVENTS}");
  events.addEventListener("reload", async () => {
    const swapped = await Promise.resolve(window.__archidocsSwap?.()).catch(() => false);
    if (!swapped) location.reload();
  });
  events.addEventListener("errors", (e) => {
    banner ??= Object.assign(document.body.appendChild(document.createElement("pre")), { id: "archidocs-dev-errors" });
    banner.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;margin:0;max-height:40vh;overflow:auto;padding:12px 14px;border-radius:8px;background:#2b0f12;color:#ffd7d9;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;box-shadow:0 6px 24px rgba(0,0,0,.35)";
    banner.textContent = "The Workspace has errors; showing the last good Bundle.\\n\\n" + JSON.parse(e.data);
  });
  events.addEventListener("ok", () => { banner?.remove(); banner = undefined; });
})();
</script>`;

/**
 * Serves the viewer with the Workspace's Bundle built in memory, and re-reads
 * the Workspace on every file change. A Workspace with errors keeps serving
 * its last good Bundle and shows the errors in the page instead.
 */
export async function serveDev({ checkout, viewerDir, host = "127.0.0.1", port = DEFAULT_DEV_PORT, onLoad }: DevOptions): Promise<DevServer> {
  let bundleJson: string | undefined;
  let errors: string | undefined;
  const clients = new Set<ServerResponse>();
  const broadcast = (event: string, data = "") => {
    for (const res of clients) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let first = true;
  const rebuild = async () => {
    const { bundle, issues } = await checkout.load();
    const failed = issues.filter((i) => i.severity === "error");
    const kept = failed.length > 0 && bundleJson !== undefined;
    onLoad?.({ issues, kept, first });
    first = false;
    if (failed.length > 0) {
      errors = formatText(failed).trimEnd();
      // With no good Bundle yet, serve this one so the page still opens.
      bundleJson ??= serializeBundle(bundle);
      broadcast("errors", errors);
      return;
    }
    const next = serializeBundle(bundle);
    const hadErrors = errors !== undefined;
    errors = undefined;
    if (next !== bundleJson) {
      bundleJson = next;
      broadcast("reload");
    } else if (hadErrors) broadcast("ok");
  };

  // Changes in a burst (an editor's write-then-rename, a git checkout, an agent's
  // run of MCP edits) make one rebuild once the Workspace has been quiet for
  // QUIET_MS, or MAX_WAIT_MS after the burst's first change at the latest.
  let timer: NodeJS.Timeout | undefined;
  let burstStart: number | undefined;
  let running: Promise<void> = Promise.resolve();
  const schedule = () => {
    clearTimeout(timer);
    burstStart ??= Date.now();
    const wait = Math.max(0, Math.min(QUIET_MS, burstStart + MAX_WAIT_MS - Date.now()));
    timer = setTimeout(() => {
      burstStart = undefined;
      running = running.then(rebuild).catch((e: unknown) => {
        errors = e instanceof Error ? e.message : String(e);
        broadcast("errors", errors);
      });
    }, wait);
  };

  await rebuild();
  const index = (await readFile(join(viewerDir, "index.html"), "utf8")).replace("</body>", `${CLIENT}</body>`);
  const site = serializeSiteFile(await checkout.name());
  const noHistory = serializeIndex({ schemaVersion: INDEX_VERSION, revisions: [] });

  const server = createServer((req, res) => {
    void (async () => {
      const path = decodeURIComponent(new URL(req.url ?? "/", "http://dev").pathname);
      const send = (body: string | Buffer, type: string) => {
        res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
        res.end(body);
      };
      if (path === EVENTS) {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
        res.write(": connected\n\n");
        if (errors !== undefined) res.write(`event: errors\ndata: ${JSON.stringify(errors)}\n\n`);
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      if (path === "/" || path === "/index.html") return send(index, TYPES[".html"]!);
      if (path === `/${LATEST_BUNDLE_PATH}`) return send(bundleJson!, TYPES[".json"]!);
      if (path === `/${SITE_FILE_PATH}`) return send(site, TYPES[".json"]!);
      // Dev mode shows the working tree only; the viewer reads an empty index as no history.
      if (path === `/${INDEX_PATH}`) return send(noHistory, TYPES[".json"]!);
      const file = normalize(join(viewerDir, path));
      if (!file.startsWith(normalize(viewerDir + sep)) || !(await stat(file).catch(() => undefined))?.isFile()) {
        res.writeHead(404).end("Not found");
        return;
      }
      send(await readFile(file), TYPES[extname(file)] ?? "application/octet-stream");
    })().catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(port, host, () => done());
  });

  const watcher: FSWatcher = watch(checkout.root, { recursive: true }, (_event, name) => {
    // Only a Workspace file feeds the Bundle. Some platforms give no name, so reload then.
    if (name && !isWorkspaceFile(name)) return;
    schedule();
  });

  const { port: bound } = server.address() as AddressInfo;
  return {
    url: `http://${host.includes(":") ? `[${host}]` : host}:${bound}/`,
    reload: async () => {
      await running;
      await rebuild();
    },
    close: async () => {
      clearTimeout(timer);
      watcher.close();
      for (const res of clients) res.end();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}
