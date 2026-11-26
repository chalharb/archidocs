import { readFile, stat } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fetchReader, LATEST_BUNDLE_PATH, type SiteReader } from "../revisions/index.ts";

/**
 * A {@link SiteReader} for `archidocs mcp --bundle <location>`: a URL or a
 * path, naming the site (its root) or a `.json` Bundle file in it. A
 * Bundle file's folder is the root, and its name is the latest Bundle's
 * path. Over HTTP it reads with `fetch`; on disk, a file's mtime and size
 * stand in for an ETag, so an unchanged file is not read again.
 */
export function siteAt(location: string): { reader: SiteReader; bundle: string } {
  if (/^https?:\/\//i.test(location)) {
    const url = new URL(location);
    if (url.pathname.endsWith(".json")) {
      const name = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
      return { reader: fetchReader(new URL("./", url).href), bundle: name };
    }
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return { reader: fetchReader(url.href), bundle: LATEST_BUNDLE_PATH };
  }
  const path = resolve(location);
  return path.endsWith(".json") ? { reader: fileReader(dirname(path)), bundle: basename(path) } : { reader: fileReader(path), bundle: LATEST_BUNDLE_PATH };
}

function fileReader(root: string): SiteReader {
  const location = (path: string) => join(root, ...path.split("/"));
  return {
    location,
    async read(path, validators) {
      const where = location(path);
      try {
        const s = await stat(where);
        const etag = `${s.mtimeMs}-${s.size}`;
        if (validators?.etag === etag) return { kind: "not_modified" };
        return { kind: "text", text: await readFile(where, "utf8"), validators: { etag } };
      } catch (error) {
        // A missing file, or a folder missing on the way to it.
        if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "ENOTDIR") return { kind: "missing" };
        throw error;
      }
    },
  };
}
