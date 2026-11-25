import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { readRepoFile, repoPath } from "../src/lib/repo.ts";

/**
 * The pages say which Node.js the CLI needs ("Node.js 22.18 or later"). That
 * is `engines.node` in the package, so every mention must name its minimum.
 */
const engines: string = JSON.parse(readRepoFile("package.json")).engines.node;
const MINIMUM = /^>=(\d+(?:\.\d+)*)$/.exec(engines)?.[1];

/** Every "Node.js <version>" in prose: the version a page tells readers they need. */
const MENTION = /Node\.js (\d+(?:\.\d+)+)/g;

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? pages(path) : /\.mdx?$/.test(entry.name) ? [path] : [];
  });
}

describe("the Node.js version on the pages", () => {
  it("reads a minimum from package.json engines", () => {
    expect(MINIMUM, `engines.node is ${engines}`).toBeDefined();
  });

  it("matches package.json engines.node", () => {
    const sources = [...pages(repoPath("website/src/content/docs")), repoPath("README.md")];
    const found = sources.flatMap((path) =>
      [...readFileSync(path, "utf8").matchAll(MENTION)].map((m) => ({ file: relative(repoPath("."), path), version: m[1] })),
    );
    // The installation page, the quick start, the tutorial and the README all name it.
    expect(found.length).toBeGreaterThanOrEqual(4);
    expect(found.filter((f) => f.version !== MINIMUM)).toEqual([]);
  });
});
