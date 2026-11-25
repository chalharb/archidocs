import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const MODULE = join(ROOT, "src", "revisions");

async function sources(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sources(path)));
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

const imports = (text: string) => [...text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);

describe("src/revisions/", () => {
  it("is browser-safe: imports nothing from node:", async () => {
    for (const file of await sources(MODULE)) {
      expect(imports(await readFile(file, "utf8")).filter((s) => s.startsWith("node:")), relative(ROOT, file)).toEqual([]);
    }
  });

  it("is entered only through its index", async () => {
    const outside = [...(await sources(join(ROOT, "src"))), ...(await sources(join(ROOT, "viewer", "src"))), ...(await sources(join(ROOT, "test")))].filter((f) => !f.startsWith(MODULE));
    for (const file of outside) {
      const deep = imports(await readFile(file, "utf8")).filter((s) => /(^|\/)revisions\//.test(s) && !s.endsWith("revisions/index.ts"));
      expect(deep, relative(ROOT, file)).toEqual([]);
    }
  });
});
