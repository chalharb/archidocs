import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { onTestFinished } from "vitest";
import { LATEST_BUNDLE_PATH, serializeBundle } from "../../src/revisions/index.ts";
import { loadWorkspace, type Files } from "./workspace.ts";

/** Builds the Bundle for a fixture Workspace, as `archidocs build --bundle-only` writes it. */
export async function bundleText(files: Files, commit: string): Promise<string> {
  const { bundle } = await loadWorkspace(files);
  return serializeBundle({ ...bundle, commit, builtAt: "2026-11-22T00:00:00Z" });
}

export interface SiteOptions {
  /** Validator headers the host sends: an ETag, a Last-Modified date, or neither. */
  validators?: "etag" | "last-modified" | "none";
  /** Other files the site serves, by path below the site root, such as `bundles/index.json`. */
  files?: Record<string, string>;
}

/**
 * A published site serving `workspace.bundle.json` and `files` on localhost,
 * as a Pages host would: it answers conditional requests for any file with
 * 304 when nothing changed. `publish` swaps in a new Bundle; `requests`
 * records every request's headers.
 */
export async function serveBundleSite(initial: string, { validators = "etag", files = {} }: SiteOptions = {}) {
  const served = new Map<string, { body: string; version: number }>(Object.entries(files).map(([path, body]) => [path, { body, version: 1 }]));
  served.set(LATEST_BUNDLE_PATH, { body: initial, version: 1 });
  let up = true;
  const requests: { path: string; headers: IncomingHttpHeaders; status: number }[] = [];
  const etag = (version: number) => `"v${version}"`;
  const lastModified = (version: number) => new Date(Date.UTC(2026, 10, 22, 0, version)).toUTCString();

  const server = createServer((req, res) => {
    const record = (status: number) => requests.push({ path: req.url ?? "", headers: req.headers, status });
    if (!up) {
      record(503);
      res.writeHead(503).end();
      return;
    }
    const file = req.url?.startsWith("/site/") ? served.get(req.url.slice("/site/".length)) : undefined;
    if (!file) {
      record(404);
      res.writeHead(404).end();
      return;
    }
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (validators === "etag") headers.etag = etag(file.version);
    if (validators === "last-modified") headers["last-modified"] = lastModified(file.version);
    const fresh =
      (validators === "etag" && req.headers["if-none-match"] === etag(file.version)) ||
      (validators === "last-modified" && req.headers["if-modified-since"] === lastModified(file.version));
    if (fresh) {
      record(304);
      res.writeHead(304, headers).end();
      return;
    }
    record(200);
    res.writeHead(200, headers).end(file.body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  onTestFinished(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const { port } = server.address() as AddressInfo;

  return {
    /** The site root; the Bundle is at `workspace.bundle.json` beneath it. */
    url: `http://127.0.0.1:${port}/site/`,
    requests,
    /** Swaps in a new Bundle, or another file's new text, with new validators. */
    publish(next: string, path: string = LATEST_BUNDLE_PATH) {
      const file = served.get(path);
      served.set(path, { body: next, version: (file?.version ?? 0) + 1 });
    },
    setUp(value: boolean) {
      up = value;
    },
  };
}
