/**
 * The page templates and style rules in `website/README.md`, as far as a test
 * can check them. It reads the hand-written files; it never builds the site.
 *
 * Each rule has a not-yet-migrated list: the pages written before the rule
 * that still break it. A rule's tests fail when
 *
 * - a page that is NOT on its list breaks the rule: fix the page, never add it to the list;
 * - a page that IS on its list now passes, or is gone: remove it from the list.
 *
 * So a list can only shrink. Tickets 06, 08 and 09 of `.scratch/docs-rewrite/`
 * empty them, and after that every list stays empty.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { repoPath } from "../src/lib/repo.ts";

interface Page {
  /** From the repo root, with forward slashes. The lists below name pages this way. */
  path: string;
  text: string;
}

const DOCS = "website/src/content/docs/docs";
const INTROS = "website/src/intros";

/** Every Markdown file under `dir` (from the repo root). */
const pagesUnder = (dir: string): Page[] =>
  readdirSync(repoPath(dir), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
    .map((f) => join(repoPath(dir), f))
    .sort()
    .map((file) => ({ path: relative(repoPath(""), file).split(sep).join("/"), text: readFileSync(file, "utf8") }));

/** A group's index page lists the group's pages. It follows no template. */
const isIndex = (page: Page): boolean => /(^|\/)index\.mdx?$/.test(page.path);

const guides = pagesUnder(`${DOCS}/guides`).filter((p) => !isIndex(p));
const concepts = pagesUnder(`${DOCS}/concepts`).filter((p) => !isIndex(p));
/** The same set `samples.test.ts` reads: every docs page, and every intro of a generated reference page. */
const handWritten = [...pagesUnder("website/src/content/docs"), ...pagesUnder(INTROS)];

// ── Reading a page ───────────────────────────────────────────────────────────

/** Blanks whatever `pattern` matches, keeping the line breaks so line numbers still hold. */
const blank = (text: string, pattern: RegExp): string => text.replace(pattern, (match) => match.replace(/[^\n]/g, ""));

/** Only at the top of the file: without the `m` flag, `^` is the start of the text. */
const FRONTMATTER = /^---\n[\s\S]*?\n---[ \t]*(?=\n|$)/;
const FENCE = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm;

/** A page's Markdown headings. A `#` line in the frontmatter or in a code block is not one. */
function headings(text: string): { level: number; text: string }[] {
  const body = blank(blank(text, FRONTMATTER), FENCE);
  return [...body.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*$/gm)].map((m) => ({ level: m[1]!.length, text: m[2]! }));
}

/**
 * A page's prose: its text without code blocks, inline code and link targets,
 * which hold ids, file names and URLs that the wording rules don't cover.
 * The frontmatter stays, because the title and description are prose.
 */
const prose = (text: string): string => [FENCE, /`[^`\n]*`/g, /\]\([^)\s]*\)/g, /\bhttps?:\/\/[^\s>)]+/g].reduce((rest, pattern) => blank(rest, pattern), text);

// ── The rules ────────────────────────────────────────────────────────────────

/** The `##` headings every how-to guide has, spelled exactly as here. */
const GUIDE_HEADINGS = ["Before you start", "Check it worked"];

/** What a guide is missing from the how-to template. */
const guideProblems = (page: Page): string[] => {
  const found = headings(page.text);
  return GUIDE_HEADINGS.filter((h) => !found.some((f) => f.level === 2 && f.text === h)).map((h) => `${page.path}: no "## ${h}" heading`);
};

/** A numbered step heading: one that starts with a number, as `## 1. Add the file` or `### Step 2` does. */
const NUMBERED = /^(step\s+)?\d/i;

/** The numbered step headings on a concept page, which has none. */
const conceptProblems = (page: Page): string[] =>
  headings(page.text)
    .filter((h) => NUMBERED.test(h.text))
    .map((h) => `${page.path}: numbered step heading "${h.text}"`);

interface BannedWord {
  /** Matched in prose at the start of a word, in any case, so "harness" also finds "Harnesses". */
  word: string;
  /** What to write. */
  instead: string;
  /** The pages that still use it. Leave it out for a word no page uses. */
  notYetMigrated?: string[];
}

/**
 * Words the style rules ban from hand-written pages. To ban another, add one
 * line: `{ word: "…", instead: "…" },`.
 */
const BANNED_WORDS: BannedWord[] = [
  {
    word: "harness",
    instead: "coding agent",
    // Ticket 06 empties this.
    notYetMigrated: [
      `${DOCS}/concepts/agents-and-mcp.mdx`,
      `${DOCS}/guides/agents/connect-mcp.mdx`,
    ],
  },
];

/** Each line of a page whose prose uses the banned word. */
const bannedWordProblems = (page: Page, banned: BannedWord): string[] => {
  const pattern = new RegExp(`\\b${banned.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  return prose(page.text)
    .split("\n")
    .flatMap((line, i) => (pattern.test(line) ? [`${page.path}:${i + 1}: "${banned.word}"; write "${banned.instead}"`] : []));
};

// ── The not-yet-migrated lists ───────────────────────────────────────────────

/** Guides still to rewrite to the how-to template. None is left; keep it empty. */
const GUIDES_NOT_YET_MIGRATED: string[] = [];

/** Concept pages with numbered step headings. None has any today; keep it empty. */
const CONCEPTS_NOT_YET_MIGRATED: string[] = [];

/**
 * Sorts a rule's problems against its not-yet-migrated list:
 * `unlisted` are the problems on pages that aren't on the list, and `stale`
 * the listed pages that have no problem left (or no longer exist).
 */
function againstList(pages: Page[], problemsOf: (page: Page) => string[], notYetMigrated: readonly string[]): { unlisted: string[]; stale: string[] } {
  const listed = new Set(notYetMigrated);
  const breaking = new Set(pages.filter((p) => problemsOf(p).length > 0).map((p) => p.path));
  return {
    unlisted: pages.filter((p) => !listed.has(p.path)).flatMap(problemsOf),
    stale: notYetMigrated.filter((path) => !breaking.has(path)),
  };
}

/** The two tests every rule gets. */
function itHolds(pages: Page[], problemsOf: (page: Page) => string[], notYetMigrated: readonly string[]): void {
  it("holds on every page that isn't on the not-yet-migrated list", () => {
    expect(againstList(pages, problemsOf, notYetMigrated).unlisted, "Fix these pages. Don't add them to the list.").toEqual([]);
  });

  it("lists only pages that still break it, so the list can only shrink", () => {
    expect(againstList(pages, problemsOf, notYetMigrated).stale, "These pages now pass, or are gone. Remove them from the list.").toEqual([]);
  });
}

// ── The tests ────────────────────────────────────────────────────────────────

describe("how-to guides have Before you start and Check it worked", () => {
  it("finds the guides", () => {
    expect(guides.length).toBeGreaterThan(0);
  });

  itHolds(guides, guideProblems, GUIDES_NOT_YET_MIGRATED);
});

describe("concept pages have no numbered step headings", () => {
  it("finds the concept pages", () => {
    expect(concepts.length).toBeGreaterThan(0);
  });

  itHolds(concepts, conceptProblems, CONCEPTS_NOT_YET_MIGRATED);
});

describe.each(BANNED_WORDS)('no hand-written page says "$word"', (banned) => {
  itHolds(handWritten, (page) => bannedWordProblems(page, banned), banned.notYetMigrated ?? []);
});

describe("the template checks", () => {
  const guide = (text: string): Page => ({ path: "guides/model/add-a-queue.mdx", text });
  const migrated = guide("---\ntitle: Add a queue\n---\n\nA queue.\n\n## Before you start\n\n## 1. Declare it\n\n## Check it worked\n");
  const unmigrated = guide("---\ntitle: Queues\n---\n\n## 1. Declare it\n\n## Check it\n");

  it("fail a guide without the headings that isn't on the list", () => {
    expect(againstList([migrated, unmigrated], guideProblems, [])).toEqual({
      unlisted: ['guides/model/add-a-queue.mdx: no "## Before you start" heading', 'guides/model/add-a-queue.mdx: no "## Check it worked" heading'],
      stale: [],
    });
  });

  it("pass a guide on the list until it has both headings, then fail until it leaves the list", () => {
    expect(againstList([unmigrated], guideProblems, [unmigrated.path])).toEqual({ unlisted: [], stale: [] });
    expect(againstList([migrated], guideProblems, [migrated.path])).toEqual({ unlisted: [], stale: [migrated.path] });
    expect(againstList([], guideProblems, ["guides/model/gone.mdx"]).stale).toEqual(["guides/model/gone.mdx"]);
  });

  it("want the guide headings at the second level, spelled exactly", () => {
    expect(guideProblems(guide("### Before you start\n\n## Check it works\n"))).toHaveLength(2);
    expect(guideProblems(guide("## Before you start\n\n```md\n## Check it worked\n```\n"))).toEqual(['guides/model/add-a-queue.mdx: no "## Check it worked" heading']);
  });

  it("read headings outside the frontmatter and code blocks only", () => {
    const text = "---\n# a YAML comment\ntitle: Views\n---\n\n## Saved Views\n\n```yaml\n# 1. a comment in a sample\n```\n\n### Layout\n";
    expect(headings(text)).toEqual([
      { level: 2, text: "Saved Views" },
      { level: 3, text: "Layout" },
    ]);
  });

  it("find a numbered step heading on a concept page", () => {
    const page = { path: "concepts/views.mdx", text: "## 1. Start from the question\n\n### Step 2: save it\n\n## C4 levels\n\n1. A list item, which is fine.\n" };
    expect(conceptProblems(page)).toEqual(['concepts/views.mdx: numbered step heading "1. Start from the question"', 'concepts/views.mdx: numbered step heading "Step 2: save it"']);
  });

  it("find a banned word in prose, with its line, and not in code or a link target", () => {
    const banned = { word: "harness", instead: "coding agent" };
    const page = {
      path: "guides/agents/connect-mcp.mdx",
      text: ["---", "description: For agent Harnesses.", "---", "", "Your harness starts it. See `harness.json` and [the docs](https://example.com/harness/).", "", "```json", '{ "harness": true }', "```", "An unharnessed agent."].join("\n"),
    };
    expect(bannedWordProblems(page, banned)).toEqual(['guides/agents/connect-mcp.mdx:2: "harness"; write "coding agent"', 'guides/agents/connect-mcp.mdx:5: "harness"; write "coding agent"']);
  });
});
