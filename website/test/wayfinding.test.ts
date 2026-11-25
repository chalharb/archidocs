import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { listPages, type ListableEntry } from "../src/lib/page-list.ts";
import { repoPath } from "../src/lib/repo.ts";
import { pageMarkdown } from "../src/render-markdown.ts";
import { buildSite, type BuildResult } from "./support.ts";

let site: BuildResult;
const file = (path: string) => join(site.outDir, path);
const read = (path: string) => readFileSync(file(path), "utf8");

/** The five sidebar groups, each with its folder under `/docs/` and the folders whose pages its index lists. */
const GROUPS = [
  { label: "Start here", folder: "start", lists: ["start"] },
  { label: "Concepts", folder: "concepts", lists: ["concepts"] },
  { label: "Guides", folder: "guides", lists: ["guides/model", "guides/publish", "guides/agents", "guides/review"] },
  { label: "Reference", folder: "reference", lists: [] },
  { label: "Examples", folder: "examples", lists: ["examples"] },
];

/** The Reference's sections, which are generated, so its index names them by hand. */
const REFERENCE_SECTIONS = ["cli", "model", "mcp", "ci", "rules", "viewer-urls", "agent-guide", "glossary", "changelog"];

const hrefs = (html: string): string[] => [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1]!);
/** The page's own content: `<main>` without the footer's previous and next links. */
const content = (html: string): string => html.slice(html.indexOf("<main"), html.indexOf("<footer"));
const sidebar = (html: string): string => html.slice(html.indexOf('<nav class="sidebar'), html.indexOf("</nav>", html.indexOf('<nav class="sidebar')));

/** The hand-written pages in a docs folder, as URLs, without the folder's index. */
const pagesIn = (folder: string): string[] =>
  readdirSync(repoPath(`website/src/content/docs/docs/${folder}`))
    .filter((name) => /\.mdx?$/.test(name) && !name.startsWith("index."))
    .map((name) => `/docs/${folder}/${name.replace(/\.mdx?$/, "")}/`);

beforeAll(async () => {
  site = await buildSite();
  if (!site.ok) throw new Error(`The site didn't build:\n${site.output}`);
});

describe("the docs home", () => {
  it("shows six cards, each linking the demo or a page that exists", () => {
    const html = content(read("docs/index.html"));
    const cards = [...html.matchAll(/<div class="sl-link-card"[^>]*>.*?<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1]!);
    expect(cards).toHaveLength(6);
    expect(cards.filter((href) => !href.startsWith("/"))).toEqual(["https://big-bank.archidocs.dev"]);
    for (const href of cards.filter((h) => h.startsWith("/"))) {
      const [path, anchor] = href.split("#") as [string, string | undefined];
      expect(existsSync(file(`${path}index.html`)), href).toBe(true);
      if (anchor) expect(read(`${path}index.html`), href).toContain(`id="${anchor}"`);
    }
  });

  it("links each group at its index page", () => {
    const links = hrefs(content(read("docs/index.html")));
    for (const group of GROUPS) expect(links, group.label).toContain(`/docs/${group.folder}/`);
  });

  it("reads as a list of links in its Markdown copy", () => {
    const markdown = read("docs.md");
    expect(markdown).toContain("- [Quick start](/docs/start/quick-start/): ");
    expect(markdown).not.toMatch(/<\/?(?:CardGrid|LinkCard)\b/);
  });
});

describe("the group index pages", () => {
  it.each(GROUPS)("$label has an index page, first in its sidebar group", ({ label, folder }) => {
    expect(existsSync(file(`docs/${folder}/index.html`))).toBe(true);
    const nav = sidebar(read("docs/index.html"));
    const heading = new RegExp(`<span class="large"[^>]*>${label}</span>`).exec(nav);
    expect(heading, `the sidebar group ${label}`).not.toBeNull();
    expect(hrefs(nav.slice(heading!.index))[0]).toBe(`/docs/${folder}/`);
  });

  it.each(GROUPS.filter((g) => g.lists.length > 0))("$label lists every page in its group, with a line on each", ({ folder, lists }) => {
    const html = content(read(`docs/${folder}/index.html`));
    const markdown = read(`docs/${folder}.md`);
    expect(markdown).not.toContain("<PageList");
    for (const page of lists.flatMap(pagesIn)) {
      expect(hrefs(html), page).toContain(page);
      expect(markdown, page).toMatch(new RegExp(`^- \\[[^\\]]+\\]\\(${page}\\): \\S`, "m"));
    }
  });

  it("the Reference index links every section of the Reference", () => {
    const links = hrefs(content(read("docs/reference/index.html")));
    for (const section of REFERENCE_SECTIONS) {
      expect(links.some((href) => href.startsWith(`/docs/reference/${section}/`)), section).toBe(true);
    }
    // Every Reference page in the sidebar belongs to a section the index names.
    const inSidebar = hrefs(sidebar(read("docs/index.html"))).filter((href) => href.startsWith("/docs/reference/") && href !== "/docs/reference/");
    expect([...new Set(inSidebar.map((href) => href.split("/")[3]))].sort()).toEqual([...REFERENCE_SECTIONS].sort());
  });
});

describe("every docs page's footer", () => {
  const version = (JSON.parse(readFileSync(repoPath("package.json"), "utf8")) as { version: string }).version;

  it("names the release in package.json as the one the site documents", () => {
    const pages = readdirSync(file("docs"), { recursive: true, encoding: "utf8" }).filter((path) => path.endsWith("index.html"));
    expect(pages.length).toBeGreaterThan(100);
    for (const page of pages) {
      const releases = [...read(`docs/${page}`).matchAll(/<p class="release"[^>]*>([^<]*)<\/p>/g)].map((m) => m[1]);
      expect(releases, page).toEqual([`Documents Archidocs v${version}, the latest release.`]);
    }
  });

  it("dates a hand-written page by its last commit, and leaves a generated page undated", () => {
    expect(read("docs/concepts/elements/index.html")).toMatch(/Last updated:\s*<time datetime="\d{4}-\d{2}-\d{2}T/);
    expect(read("docs/reference/cli/check/index.html")).not.toContain("Last updated:");
  });
});

describe("llms.txt", () => {
  it("indexes every group, and each group's set holds its index page", () => {
    const index = read("llms.txt");
    const sets = { "Start here": "start-here", Concepts: "concepts", Guides: "guides", Examples: "examples" };
    for (const [label, slug] of Object.entries(sets)) {
      expect(index).toContain(`- [${label}](https://archidocs.dev/_llms-txt/${slug}.txt)`);
      expect(read(`_llms-txt/${slug}.txt`), label).toContain(`\n# ${label}\n`);
    }
    // The Reference is one set per section.
    for (const label of ["CLI reference", "Model YAML reference", "MCP tools", "Check rules", "Authoring guide for agents"]) expect(index).toContain(`- [${label}](`);
    expect(read("llms-full.txt")).toContain("\n# Reference\n");
    expect(read("llms-small.txt")).not.toContain("\n# Examples\n");
  });
});

describe("the page list", () => {
  const entry = (id: string, order?: number, extra: Partial<ListableEntry["data"]> = {}): ListableEntry => ({
    id,
    data: { title: id.split("/").at(-1)!, description: `About ${id}.`, sidebar: { order }, ...extra },
  });

  it("lists a folder's own pages in the sidebar's order, without its index, drafts and hidden pages", () => {
    const entries = [
      entry("docs/a", 0),
      entry("docs/a/second", 2),
      entry("docs/a/first", 1),
      entry("docs/a/unordered"),
      entry("docs/a/sub/nested", 1),
      entry("docs/a/draft", 3, { draft: true }),
      entry("docs/a/hidden", 3, { sidebar: { hidden: true } }),
      entry("docs/b/other", 1),
    ];
    expect(listPages(entries, "docs/a")).toEqual([
      { href: "/docs/a/first/", title: "first", description: "About docs/a/first." },
      { href: "/docs/a/second/", title: "second", description: "About docs/a/second." },
      { href: "/docs/a/unordered/", title: "unordered", description: "About docs/a/unordered." },
    ]);
  });

  it("fails on a page with no description, and on a folder with no pages", () => {
    expect(() => listPages([{ id: "docs/a/bare", data: { title: "Bare" } }], "docs/a")).toThrow("docs/a/bare has no description");
    expect(() => listPages([], "docs/none")).toThrow("docs/none");
  });

  it("is written into the Markdown copy, as link cards are", () => {
    const body = ['import PageList from "../PageList.astro";', "", "<CardGrid>", '  <LinkCard title="Quick start" href="/docs/start/quick-start/" description="Go." />', "</CardGrid>", "", '<PageList directory="docs/a" />', ""].join("\n");
    expect(pageMarkdown(body, [entry("docs/a/first", 1)])).toBe("- [Quick start](/docs/start/quick-start/): Go.\n\n- [first](/docs/a/first/): About docs/a/first.\n");
  });
});
