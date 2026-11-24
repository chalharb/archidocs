import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath, VERSION } from "../src/lib/repo.ts";

/**
 * Readers copy `chalharb/archidocs@v1` and the GitLab template's `v1` URL
 * from the docs. The release workflow moves that major tag on every release
 * (the major-tag job in publish.yml), so the pages must name the major of the
 * version they document, never another ref.
 */
const MAJOR = `v${VERSION.split(".")[0]}`;

/** `chalharb/archidocs@<ref>` as an Action, and `…/chalharb/archidocs/<ref>/…` as a raw file URL. */
const REFS = [/chalharb\/archidocs@([\w.-]+)/g, /raw\.githubusercontent\.com\/chalharb\/archidocs\/([\w.-]+)\//g];

const SKIP = new Set(["node_modules", "site", "dist", ".astro", ".archidocs"]);

function files(dir: string, keep: (path: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, keep) : keep(path) ? [path] : [];
  });
}

/** What readers copy from: the hand-written pages and intros, the README, and the example repos' workflows. */
const sources = [
  ...files(repoPath("website/src/content"), (p) => /\.mdx?$/.test(p)),
  ...files(repoPath("website/src/intros"), (p) => p.endsWith(".md")),
  ...files(repoPath("examples"), (p) => /\.ya?ml$/.test(p)),
  repoPath("README.md"),
];

function refsIn(text: string): string[] {
  return REFS.flatMap((pattern) => [...text.matchAll(pattern)].map((m) => m[1]!));
}

describe("references to this repo's release tag", () => {
  it("reads the Action and raw-file forms", () => {
    expect(refsIn("uses: chalharb/archidocs@v1\nremote: https://raw.githubusercontent.com/chalharb/archidocs/v2/templates/x.yml")).toEqual(["v1", "v2"]);
    expect(refsIn("https://github.com/chalharb/archidocs/blob/main/schemas/x.json and `chalharb/archidocs@<ref>`")).toEqual([]);
  });

  it(`name the major tag, ${MAJOR}`, () => {
    const found = sources.flatMap((path) => refsIn(readFileSync(path, "utf8")).map((ref) => ({ file: relative(repoPath("."), path), ref })));
    // The tutorial, the publish guides and the README all show one.
    expect(found.length).toBeGreaterThanOrEqual(5);
    expect(found.filter((f) => f.ref !== MAJOR)).toEqual([]);
  });
});
