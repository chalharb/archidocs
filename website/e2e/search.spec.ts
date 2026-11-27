import { expect, test, type Page } from "@playwright/test";
import { commandList } from "../../src/cli/commands.ts";
import { rules } from "../../src/core/rules.ts";
import { PAGEFIND_RANKING } from "../src/lib/search.ts";
import { listTools, toolPath } from "../src/reference/mcp.ts";

/** The URLs of Pagefind's first results for each query, searching the built index with the ranking the site's search box uses. */
async function firstResults(page: Page, queries: string[]): Promise<Record<string, string | undefined>> {
  return page.evaluate(
    async ({ queries, ranking }) => {
      const pagefind = await import(/* @vite-ignore */ `${location.origin}/pagefind/pagefind.js`);
      await pagefind.options({ ranking });
      await pagefind.init();
      const found: Record<string, string | undefined> = {};
      for (const q of queries) {
        const [first] = (await pagefind.search(q)).results;
        found[q] = first ? ((await first.data()) as { url: string }).url : undefined;
      }
      return found;
    },
    { queries, ranking: PAGEFIND_RANKING },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto("/docs/");
});

test("a rule id finds its rule's page first, for every rule", async ({ page }) => {
  const expected = Object.fromEntries(rules.map((r) => [r.id, `/docs/reference/rules/${r.id}/`]));
  expect(await firstResults(page, Object.keys(expected))).toEqual(expected);
});

test("a partial rule id finds the rule's page first", async ({ page }) => {
  expect(await firstResults(page, ["via-on", "ancestor-desc"])).toEqual({
    "via-on": "/docs/reference/rules/via-on-sync/",
    "ancestor-desc": "/docs/reference/rules/ancestor-descendant-relationship/",
  });
});

/**
 * Flags that are a plain word a guide is titled with, so searching the word
 * fairly finds the guide: `--preview` (PR previews), `--skill` (Install the
 * agent skill), `--bundle` (also part of `--bundle-only`), `--check` (`mcp
 * --check`, but also the `check` command and Check in CI), `--project` and
 * `--owner` (`gaps`, but also Workspace and Projects, and Teams and ownership).
 */
const PLAIN_WORD_FLAGS = new Set(["preview", "skill", "bundle", "check", "project", "owner"]);

test("a CLI flag only one command takes finds that command's page first", async ({ page }) => {
  const owners = new Map<string, string[]>();
  for (const c of commandList) for (const flag of Object.keys(c.flags)) owners.set(flag, [...(owners.get(flag) ?? []), c.name]);
  const unique = [...owners].filter(([flag, names]) => names.length === 1 && !PLAIN_WORD_FLAGS.has(flag));
  const expected = Object.fromEntries(unique.map(([flag, [name]]) => [`--${flag}`, `/docs/reference/cli/${name!.replace(/ /g, "-")}/`]));
  expect(Object.keys(expected)).toContain("--all-saved");
  expect(await firstResults(page, Object.keys(expected))).toEqual(expected);
});

test("an MCP tool name finds the tool's own page first, for every tool", async ({ page }) => {
  const tools = await listTools();
  const expected = Object.fromEntries(tools.map((t) => [t.name, toolPath(t)]));
  expect(expected["upsert_element"]).toBe("/docs/reference/mcp/upsert_element/");
  // The `check` tool shares its name with the `archidocs check` command, whose page fairly comes first.
  delete expected["check"];
  expect(await firstResults(page, Object.keys(expected))).toEqual(expected);
});

test("an old read-tools or write-tools anchor still lands on the tool's heading", async ({ page }) => {
  await page.goto("/docs/reference/mcp/write-tools/#upsert_element");
  await expect(page.locator("h2#upsert_element")).toBeVisible();
  await expect(page.locator('.sl-markdown-content a[href="/docs/reference/mcp/upsert_element/"]').first()).toBeVisible();
});

test("the search box finds a rule and links to its page", async ({ page }) => {
  await page.getByRole("button", { name: "Search" }).first().click();
  await page.locator(".pagefind-ui__search-input").fill("unknown-field");
  await expect(page.locator(".pagefind-ui__result-link").first()).toHaveAttribute("href", "/docs/reference/rules/unknown-field/");
});
