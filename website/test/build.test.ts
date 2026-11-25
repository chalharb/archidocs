import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { rules } from "../../src/core/rules.ts";
import { EXAMPLES, exportDiagrams } from "../src/lib/examples.ts";
import { repoPath } from "../src/lib/repo.ts";
import { buildSite, type BuildResult } from "./support.ts";

let site: BuildResult;
const file = (path: string) => join(site.outDir, path);
const read = (path: string) => readFileSync(file(path), "utf8");

beforeAll(async () => {
  site = await buildSite();
  if (!site.ok) throw new Error(`The site didn't build:\n${site.output}`);
});

describe("the built site", () => {
  it("has a page for every rule in the registry", () => {
    for (const rule of rules) expect(existsSync(file(`docs/reference/rules/${rule.id}/index.html`)), rule.id).toBe(true);
  });

  it("shows what check prints and why on a rule's page, and groups the rule index by area", () => {
    const page = read("docs/reference/rules/unknown-element.md");
    expect(page).toContain('```text\nshop/cart.yaml:4:9  error  unknown-element  Unknown Element "chekout" in Project "shop"; did you mean "checkout"?\n```');
    expect(page).toMatch(/^## Why$/m);
    const index = read("docs/reference/rules/index.html");
    for (const area of ["workspace", "elements", "relationships", "deployments", "views", "decisions"]) expect(index).toContain(`<h2 id="${area}"`);
  });

  it("has llms.txt, llms-full.txt and llms-small.txt, the small one without the Examples and the Changelog", () => {
    const index = read("llms.txt");
    expect(index).toContain("archidocs guide");
    expect(index).toContain("get_authoring_guide");
    expect(index).toContain("https://archidocs.dev/llms-full.txt");
    const full = read("llms-full.txt");
    const small = read("llms-small.txt");
    for (const title of ["# Big Bank", "# Changelog"]) {
      expect(full).toContain(`\n${title}\n`);
      expect(small).not.toContain(`\n${title}\n`);
    }
    expect(small).toContain("\n# archidocs export\n");
    // The landing page is not a docs page, so it is in none of them.
    expect(full).not.toContain("Same answer for people and agents");
  });

  it("has a Markdown copy of each page, hand-written and generated", () => {
    expect(read("docs/start/quick-start.md")).toContain("archidocs init");
    // Sample fences are filled from their files, Diagrams become images, and MDX imports go.
    const tutorial = read("docs/start/tutorial.md");
    expect(tutorial).toContain('```yaml title="digital/project.yaml"\nid: digital\n');
    expect(tutorial).not.toContain('file="examples/');
    expect(tutorial).not.toMatch(/^import /m);
    expect(read("docs/examples/big-bank.md")).toContain("![Everything that depends on the Big Bank mainframe");
    const generated = read("docs/reference/cli/export.md");
    expect(generated).toMatch(/^# archidocs export$/m);
    expect(generated).toMatch(/^### `--all-saved`$/m);
  });

  it("carries the Archidocs brand: the mark beside the title, and the viewer's favicon", () => {
    const html = read("docs/index.html");
    expect(html).toMatch(/<img[^>]*src="\/_astro\/archidocs-mark-dark\.[^"]+\.svg"/);
    expect(html).toMatch(/<img[^>]*src="\/_astro\/archidocs-mark-light\.[^"]+\.svg"/);
    expect(html).toContain('href="/favicon.svg"');
    expect(read("favicon.svg")).toBe(readFileSync(repoPath("viewer/public/favicon.svg"), "utf8"));
  });

  it("serves the Markdown copies and llms files as UTF-8", () => {
    expect(read("_headers")).toContain("Content-Type: text/markdown; charset=utf-8");
  });

  it("has every example's Saved Views in light and dark, labelled with the example and release", async () => {
    const diagrams = await exportDiagrams();
    const version = (JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version: string }).version;
    for (const example of EXAMPLES) {
      const keys = [...diagrams.keys()].filter((k) => k.startsWith(`${example.slug}/`));
      expect(keys.length, example.slug).toBeGreaterThan(0);
      for (const key of keys) {
        const svg = read(`diagrams/${key}.svg`);
        expect(svg).toContain(`${example.name} · v${version}`);
      }
      expect(keys.filter((k) => k.includes("/light/")).length).toBe(keys.filter((k) => k.includes("/dark/")).length);
    }
  });

  it("shows a Diagram in both themes with a link to the live viewer", () => {
    const html = read("docs/examples/big-bank/index.html");
    expect(html).toContain('src="/diagrams/big-bank/light/digital-mainframe-outage.svg"');
    expect(html).toContain('src="/diagrams/big-bank/dark/digital-mainframe-outage.svg"');
    expect(html).toContain('href="https://big-bank.archidocs.dev/#/view/digital:mainframe-outage"');
  });
});
