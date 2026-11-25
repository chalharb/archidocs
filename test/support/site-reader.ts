import type { SiteRead, SiteReader, Validators } from "../../src/revisions/index.ts";

/**
 * An in-memory {@link SiteReader}: files by path below the site root. Each
 * file has an ETag that changes when it is set again, and a read that sends
 * the current one is answered "not modified". `reads` records every read
 * with the validators it sent; a path set to an Error throws it.
 */
export function memoryReader(initial: Record<string, string | Error> = {}) {
  const files = new Map<string, { body: string | Error; version: number }>();
  let versions = 0;
  const set = (path: string, body: string | Error | undefined) => {
    if (body === undefined) files.delete(path);
    else files.set(path, { body, version: ++versions });
  };
  for (const [path, body] of Object.entries(initial)) set(path, body);
  const reads: { path: string; validators: Validators | undefined; answer: SiteRead["kind"] | "error" }[] = [];

  const reader: SiteReader = {
    location: (path) => `memory:/${path}`,
    async read(path, validators) {
      const file = files.get(path);
      if (!file) {
        reads.push({ path, validators, answer: "missing" });
        return { kind: "missing" };
      }
      if (file.body instanceof Error) {
        reads.push({ path, validators, answer: "error" });
        throw file.body;
      }
      const etag = `"v${file.version}"`;
      if (validators?.etag === etag) {
        reads.push({ path, validators, answer: "not_modified" });
        return { kind: "not_modified" };
      }
      reads.push({ path, validators, answer: "text" });
      return { kind: "text", text: file.body, validators: { etag } };
    },
  };

  return {
    reader,
    reads,
    /** Replaces a file (a new ETag), or removes it with `undefined`. */
    set,
    /** The reads of one path, in order. */
    readsOf: (path: string) => reads.filter((r) => r.path === path),
  };
}
