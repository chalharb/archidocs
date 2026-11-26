import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import { writeSite } from "../../src/history/index.ts";
import { INDEX_VERSION, serializeBundle, type RevisionEntry } from "../../src/revisions/index.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { loadWorkspace } from "../support/workspace.ts";

const sha = (c: string) => c.repeat(40);
const [KEPT, STALE, BASE] = [sha("a"), sha("b"), sha("c")];
const entry = (s: string, bundle = true): RevisionEntry => ({
  sha: s,
  date: "2026-11-25T00:00:00Z",
  subject: "A Revision",
  author: "Ana Author",
  tags: [],
  counts: { added: 0, removed: 0, changed: 0 },
  changedIds: [],
  bundle,
});

async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), "archidocs-site-"));
  onTestFinished(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

const listing = async (dir: string) => (await readdir(dir, { recursive: true })).map((f) => f.split("\\").join("/")).sort();

describe("writeSite", () => {
  it("removes a past Bundle no longer kept and keeps index.json and other files", async () => {
    const { bundle } = await loadWorkspace(validWorkspace);
    const out = await tempDir();
    await mkdir(join(out, "bundles"), { recursive: true });
    await writeFile(join(out, "bundles", `${STALE}.json`), "stale");
    await writeFile(join(out, "bundles", "notes.txt"), "not a Bundle");
    const cache = join(await tempDir(), `${KEPT}.json`);
    await writeFile(cache, "cached Bundle");

    const index = { schemaVersion: INDEX_VERSION, revisions: [entry(KEPT), entry(STALE, false)] };
    await writeSite(out, { bundle, workspace: "shop", index, past: [{ sha: KEPT, from: cache }] });

    expect(await listing(out)).toEqual(["bundles", `bundles/${KEPT}.json`, "bundles/index.json", "bundles/notes.txt", "site.json", "workspace.bundle.json"]);
    expect(await readFile(join(out, "bundles", `${KEPT}.json`), "utf8")).toBe("cached Bundle");
    expect(await readFile(join(out, "bundles", "index.json"), "utf8")).toBe(JSON.stringify(index, null, 2) + "\n");
    expect(await readFile(join(out, "site.json"), "utf8")).toBe('{"workspace":"shop"}\n');
    expect(await readFile(join(out, "workspace.bundle.json"), "utf8")).toBe(serializeBundle(bundle));
  });

  it("writes only the Bundle for --bundle-only", async () => {
    const { bundle } = await loadWorkspace(validWorkspace);
    const out = join(await tempDir(), "out");
    await writeSite(out, { bundle });
    expect(await listing(out)).toEqual(["workspace.bundle.json"]);
  });

  it("clears bundles/ for a preview", async () => {
    const { bundle } = await loadWorkspace(validWorkspace);
    const out = await tempDir();
    await mkdir(join(out, "bundles"), { recursive: true });
    await writeFile(join(out, "bundles", `${STALE}.json`), "stale");
    await writeFile(join(out, "bundles", "notes.txt"), "left by an earlier build");

    const preview = { base: "main", baseSha: BASE, headSha: KEPT };
    const index = { schemaVersion: INDEX_VERSION, preview, revisions: [entry(KEPT), entry(BASE)] };
    await writeSite(out, { bundle, workspace: "shop", index, past: [{ sha: BASE, bundle }, { sha: KEPT, bundle }], clear: true });

    expect(await listing(out)).toEqual(["bundles", `bundles/${KEPT}.json`, `bundles/${BASE}.json`, "bundles/index.json", "site.json", "workspace.bundle.json"].sort());
    expect(await readFile(join(out, "bundles", `${BASE}.json`), "utf8")).toBe(serializeBundle(bundle));
    expect(await readFile(join(out, "bundles", "index.json"), "utf8")).toBe(JSON.stringify(index, null, 2) + "\n");
  });
});
