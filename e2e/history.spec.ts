import { expect, test, type Page } from "@playwright/test";
import { hash, node, open, settled } from "./support.ts";
import { PORT, SITES } from "./sites.ts";

test.use({ baseURL: `http://127.0.0.1:${PORT}${SITES.history}` });

const panel = (page: Page) => page.getByRole("complementary", { name: "Element" });
const changesList = (page: Page) => page.getByRole("complementary", { name: "Changes" });
/** Each node's Compare mark, by id. */
const marks = (page: Page) => page.locator("[data-node]").evaluateAll((els) => Object.fromEntries(els.map((e) => [e.getAttribute("data-node")!, e.getAttribute("data-change")])));
const edge = (page: Page, from: string, to: string) => page.locator(`path[data-edge-from="${from}"][data-edge-to="${to}"]`);

/** The site's Revisions, newest first, as `bundles/index.json` lists them. */
async function revisions(page: Page): Promise<{ sha: string; subject: string; tags: string[]; bundle: boolean }[]> {
  return (await (await page.request.get("bundles/index.json")).json()).revisions;
}

test.describe("Compare", () => {
  test("marks added nodes and edges with a green +, removed ones as dashed ghosts and changed ones with an amber dot", async ({ page }) => {
    await open(page, "#/view/c2?closed=shop:checkout,payments:payments,shop:legacy&vs=v1");

    expect(await marks(page)).toEqual({
      "payments:payments": "unchanged",
      "shop:checkout": "unchanged",
      "shop:events": "unchanged",
      "shop:legacy": "removed",
      "shop:shopper": "unchanged",
      "shop:web": "changed",
      "shop:wishlist": "added",
    });
    await expect(node(page, "shop:wishlist").getByTestId("added")).toHaveText("+");
    await expect(node(page, "shop:web").getByTestId("changed")).toBeVisible();
    await expect(node(page, "shop:legacy")).toHaveClass(/arc-removed/);
    await expect(edge(page, "shop:wishlist", "shop:checkout")).toHaveAttribute("data-change", "added");
    await expect(edge(page, "shop:legacy", "payments:payments")).toHaveAttribute("data-change", "removed");
    await expect(page.getByRole("region", { name: "Compare" })).toContainText("Compare v1 → latest");
  });

  test("a Change in the Changes list focuses it, and the panel shows a changed Element's fields before and after", async ({ page }) => {
    await open(page, "#/view/c2?vs=v1");

    await changesList(page).getByRole("button", { name: /Web shop/ }).click();

    expect(hash(page)).toContain("sel=shop:web");
    await expect(panel(page).getByRole("region", { name: "Changed in this comparison" })).toContainText(/name\s*"Web"\s*→\s*"Web shop"/);
    await changesList(page).getByRole("button", { name: /Old cart/ }).click();
    await settled(page);
    expect(hash(page)).toContain("sel=shop:old-cart");
    await expect(node(page, "shop:old-cart")).toHaveAttribute("data-change", "removed");
  });

  test("a removed System's C2 opens from its ghost, drawn from the earlier side", async ({ page }) => {
    await open(page, "#/view/c2?closed=shop:legacy&vs=v1");

    await node(page, "shop:legacy").dblclick();
    await settled(page);

    expect(hash(page)).toBe("#/view/c2/shop:legacy?vs=v1");
    expect(await marks(page)).toEqual({ "payments:payments": "removed", "shop:legacy": "removed", "shop:old-cart": "removed" });
    await expect(edge(page, "shop:old-cart", "payments:payments")).toHaveAttribute("data-change", "removed");
  });

  test("✕ on the Compare chip clears it", async ({ page }) => {
    await open(page, "#/view/c2?vs=v1");
    await page.getByRole("button", { name: "Clear compare" }).click();
    await settled(page);

    expect(hash(page)).toBe("#/view/c2");
    await expect(node(page, "shop:legacy")).toHaveCount(0);
    await page.goBack();
    await settled(page);
    await expect(node(page, "shop:legacy")).toHaveCount(1);
  });
});

test.describe("A past Revision", () => {
  test("`at` shows the viewer at that Revision under a banner, and Back to latest leaves it", async ({ page }) => {
    await open(page, "#/view/c2?at=v1");

    await expect(page.getByRole("status", { name: "Past Revision" })).toContainText("Add the Legacy shop");
    await expect(node(page, "shop:legacy")).toHaveCount(1);
    await expect(node(page, "shop:wishlist")).toHaveCount(0);

    await page.getByRole("link", { name: "Back to latest" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2");
    await expect(node(page, "shop:legacy")).toHaveCount(0);
  });

  test("`at` on a Revision whose Bundle was dropped shows history_unavailable guidance", async ({ page }) => {
    const first = (await revisions(page)).at(-1)!;
    expect(first.bundle).toBe(false);

    await page.goto(`./#/view/c2?at=${first.sha.slice(0, 7)}`);

    const message = page.getByRole("alert");
    await expect(message).toContainText("history_unavailable");
    await expect(message).toContainText("First model");
    await expect(message).toContainText(`archidocs diff ${first.sha.slice(0, 7)}`);
    await expect(page.getByRole("link", { name: "Back to latest" })).toBeVisible();
  });

  test("`at` with a short sha that starts two Revisions lists both, and each opens its Revision", async ({ page }) => {
    const index = await (await page.request.get("bundles/index.json")).json();
    const v1 = (index.revisions as { sha: string; tags: string[] }[]).find((r) => r.tags.includes("v1"))!;
    const prefix = v1.sha.slice(0, 4);
    // No two of the fixture's shas share a prefix, so the index gains a twin of v1's.
    const twin = { ...v1, sha: `${prefix}${v1.sha.slice(4).replace(/./g, (c) => (c === "0" ? "1" : "0"))}`, tags: [], subject: "A twin" };
    await page.route("**/bundles/index.json", (route) => route.fulfill({ json: { ...index, revisions: [twin, ...index.revisions] } }));

    await page.goto(`./#/view/c2?at=${prefix}`);

    const message = page.getByRole("alert");
    await expect(message).toContainText(`More than one Revision “${prefix}”`);
    await expect(message.getByRole("link", { name: /A twin/ })).toHaveAttribute("href", `#/view/c2?at=${twin.sha.slice(0, 7)}`);
    await message.getByRole("link", { name: /Add the Legacy shop/ }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2?at=v1");
    await expect(page.getByRole("status", { name: "Past Revision" })).toContainText("Add the Legacy shop");
  });

  test("the Revision timeline marks tags and starts Compare from a Revision", async ({ page }) => {
    await open(page, "#/view/c2");

    await page.getByRole("button", { name: "Revisions" }).click();
    const timeline = page.getByRole("menu", { name: "Revisions" });
    await expect(timeline.getByRole("listitem")).toHaveCount(3);
    await expect(timeline.getByRole("listitem").nth(1)).toContainText("v1");
    await expect(timeline.getByRole("listitem").nth(2)).toContainText("not kept");
    await timeline.getByRole("button", { name: "Compare from v1" }).click();
    await settled(page);

    expect(hash(page)).toBe("#/view/c2?vs=v1");
    await expect(node(page, "shop:wishlist")).toHaveAttribute("data-change", "added");
  });
});

test.describe("Element History tab", () => {
  test("lists the Revisions that changed the Element and opens Compare with the one before", async ({ page }) => {
    await open(page, "#/view/c2?sel=shop:web");

    await panel(page).getByRole("tab", { name: "History" }).click();
    const rows = panel(page).getByRole("tabpanel", { name: "History" }).getByRole("listitem");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Add Wishlist, rename Web, retire Legacy");
    await expect(rows.nth(1)).toContainText("First model");
    await rows.nth(0).getByRole("button").click();
    await settled(page);

    expect(hash(page)).toBe("#/view/c2?sel=shop:web&vs=v1");
    await expect(node(page, "shop:web")).toHaveAttribute("data-change", "changed");
  });
});
