import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { load, nodeFileSystem, type Issue } from "../core/index.ts";
import { gitHead } from "../git.ts";
import { Bundle } from "../schema/bundle.ts";

/** The Bundle the server answers from, with the issues Load found building it. */
export interface Snapshot {
  bundle: Bundle;
  issues: Issue[];
}

/**
 * Where the server reads the Workspace from. One source per server process,
 * set at startup: a local checkout, or a published Bundle file or URL.
 */
export type Source = CheckoutSource | BundleSource;

interface SourceBase {
  /** Whether the source can take edits at all; a Bundle never can. */
  readonly writesAllowed: boolean;
  /** The current Bundle, refreshed first if the source has changed. Rejects when the source can't be read. */
  snapshot(): Promise<Snapshot>;
}

export interface CheckoutSource extends SourceBase {
  readonly kind: "checkout";
  /** The Workspace root: the folder holding `workspace.yaml`. */
  readonly root: string;
}

export interface BundleSource extends SourceBase {
  readonly kind: "bundle";
  /** The Bundle file's URL or absolute path. */
  readonly location: string;
}

/**
 * A local checkout: the Bundle is built in memory and rebuilt when a file
 * under the Workspace root changes or HEAD moves. Change is detected per
 * call from every model file's mtime and size, so an edit is seen by the very
 * next call with no watcher to start or stop.
 */
export function checkoutSource({ root }: { root: string }): CheckoutSource {
  let cached: { key: string; snapshot: Snapshot } | undefined;
  return {
    kind: "checkout",
    root,
    writesAllowed: true,
    async snapshot() {
      const [files, head] = await Promise.all([fingerprint(root), gitHead(root)]);
      const key = `${head.commit}\n${head.builtAt}\n${files}`;
      if (cached?.key !== key) {
        cached = { key, snapshot: await load({ fs: nodeFileSystem(), root, commit: head.commit, builtAt: head.builtAt }) };
      }
      return cached.snapshot;
    },
  };
}

/** How long a fetched Bundle is trusted before the source is asked again. */
const RECHECK_MS = 60_000;

const BUNDLE_FILE = "workspace.bundle.json";

/**
 * A published Workspace Bundle, read-only. `location` is a URL or a path,
 * naming either the Bundle file or the site (folder) that holds
 * `workspace.bundle.json`. The source is re-checked at most every 60 s; over
 * HTTP the re-check is a conditional request when the host gave an ETag or
 * Last-Modified, so an unchanged Bundle costs a 304. A source that can't be
 * read, or doesn't hold a valid Bundle, rejects and the tool returns
 * `source_unavailable`; the next call tries again.
 */
export function bundleSource({ location }: { location: string }): BundleSource {
  const url = /^https?:\/\//i.test(location) ? bundleUrl(location) : undefined;
  let path: string | undefined;
  let cached: { snapshot: Snapshot; checkedAt: number; etag?: string; lastModified?: string; fileKey?: string } | undefined;

  const fetchUrl = async (href: string) => {
    const headers: Record<string, string> = { accept: "application/json" };
    if (cached?.etag) headers["if-none-match"] = cached.etag;
    if (cached?.lastModified) headers["if-modified-since"] = cached.lastModified;
    const response = await fetch(href, { headers, cache: "no-store" });
    if (response.status === 304 && cached) return cached;
    if (!response.ok) throw new Error(`${href} answered ${response.status} ${response.statusText}`.trim());
    return {
      snapshot: parse(await response.text(), href),
      checkedAt: 0,
      etag: response.headers.get("etag") ?? undefined,
      lastModified: response.headers.get("last-modified") ?? undefined,
    };
  };

  const readPath = async () => {
    path ??= await bundlePath(location);
    const s = await stat(path);
    const fileKey = `${s.mtimeMs}\0${s.size}`;
    if (cached?.fileKey === fileKey) return cached;
    return { snapshot: parse(await readFile(path, "utf8"), path), checkedAt: 0, fileKey };
  };

  return {
    kind: "bundle",
    get location() {
      return url ?? path ?? resolve(location);
    },
    writesAllowed: false,
    async snapshot() {
      const now = Date.now();
      if (cached && now - cached.checkedAt < RECHECK_MS) return cached.snapshot;
      const next = url ? await fetchUrl(url) : await readPath();
      cached = { ...next, checkedAt: now };
      return cached.snapshot;
    },
  };
}

/** A site root URL becomes its `workspace.bundle.json`; a URL to a `.json` file is used as given. */
function bundleUrl(location: string): string {
  const url = new URL(location);
  if (url.pathname.endsWith(".json")) return url.href;
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return new URL(BUNDLE_FILE, url).href;
}

/** A folder becomes its `workspace.bundle.json`; a file is used as given. */
async function bundlePath(location: string): Promise<string> {
  const path = resolve(location);
  return (await stat(path)).isDirectory() ? join(path, BUNDLE_FILE) : path;
}

function parse(text: string, from: string): Snapshot {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${from} is not JSON.`);
  }
  const bundle = Bundle.safeParse(json);
  if (!bundle.success) throw new Error(`${from} is not a Workspace Bundle this version can read.`);
  // A Bundle is only ever published from a Workspace with no errors; check's warnings aren't kept in it.
  return { bundle: bundle.data, issues: [] };
}

/** Path, mtime and size of every `.yaml` file Load would read, in a stable order. */
async function fingerprint(root: string): Promise<string> {
  const lines: string[] = [];
  const dirs = [root];
  for (let i = 0; i < dirs.length; i++) {
    for (const entry of await readdir(dirs[i]!, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const path = join(dirs[i]!, entry.name);
      if (entry.isDirectory()) dirs.push(path);
      else if (entry.name.endsWith(".yaml")) {
        const s = await stat(path);
        lines.push(`${path}\0${s.mtimeMs}\0${s.size}`);
      }
    }
  }
  return lines.sort().join("\n");
}
