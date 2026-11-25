import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatPlace, parsePlace, URL_PARAMETERS, VIEW_ROUTE } from "../../viewer/src/place.ts";
import { repoPath } from "../src/lib/repo.ts";
import { generatedPages } from "../src/reference/index.ts";
import { VIEWER_URLS_ID, WORKED_LINKS, workedLinkUrl } from "../src/reference/viewer-urls.ts";

const page = async () => {
  const found = (await generatedPages()).find((p) => p.id === VIEWER_URLS_ID);
  expect(found).toBeDefined();
  return found!;
};

/** The `Who` column of the introduction page's questions table. */
function introductionPersonas(): string[] {
  const intro = readFileSync(repoPath("website/src/content/docs/docs/start/introduction.mdx"), "utf8");
  const section = intro.slice(intro.indexOf("## The questions it answers"));
  return [...section.matchAll(/^\| ([^|]+?) \| [^|]+ \|/gm)].map((m) => m[1]!).filter((who) => who !== "Who" && !/^-+$/.test(who));
}

describe("the viewer URL reference", () => {
  it("shows the route from the viewer's own list", async () => {
    expect((await page()).body).toContain(VIEW_ROUTE.syntax);
  });

  it("has a row for every parameter the viewer reads", async () => {
    const { body } = await page();
    for (const p of URL_PARAMETERS) expect(body, p.name).toMatch(new RegExp(`^\\| \`${p.name}\` \\|`, "m"));
  });

  it("says the URLs are stable within a major release", async () => {
    expect((await page()).body).toMatch(/within a major release/);
  });

  it("has a worked link into the Big Bank demo for every question on the introduction page", async () => {
    const { body } = await page();
    const personas = introductionPersonas();
    expect(personas.length).toBeGreaterThan(0);
    expect([...new Set(WORKED_LINKS.map((l) => l.who))].sort()).toEqual([...personas].sort());
    for (const link of WORKED_LINKS) {
      expect(workedLinkUrl(link)).toBe(`https://big-bank.archidocs.dev/${formatPlace(link.place)}`);
      expect(body).toContain(`(${workedLinkUrl(link)})`);
    }
  });

  it("writes each worked link as the viewer reads it back", () => {
    for (const link of WORKED_LINKS) expect(parsePlace(formatPlace(link.place))).toEqual(link.place);
  });

  it("doesn't write the route by hand, so it follows the viewer when the route changes", () => {
    const source = readFileSync(repoPath("website/src/reference/viewer-urls.ts"), "utf8");
    expect(source).not.toContain("#/view");
  });
});
