import { expect, test, type Page } from "@playwright/test";
import { PORT, SITES } from "./sites.ts";
import { hash, node, open, settled } from "./support.ts";

test.use({ baseURL: `http://127.0.0.1:${PORT}${SITES.decisions}` });

/** The Element panel shown while something is selected. */
const panel = (page: Page) => page.getByRole("complementary", { name: "Element" });
/** The ADR reader. */
const reader = (page: Page) => page.getByRole("article", { name: "ADR" });

test.describe("Developer: what decisions are behind this Element?", () => {
  test("the ADRs tab lists the ADRs linking the Element or its descendants, newest first, with superseded ones marked", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout&sel=shop:cart");
    await panel(page).getByRole("tab", { name: "ADRs" }).click();

    const rows = panel(page).getByRole("tabpanel", { name: "ADRs" }).getByRole("listitem");
    await expect(rows).toHaveText([
      /^payments:0001\s*Charge from the cart\s*Proposed\s*2026-03-01/,
      /^shop:0002\s*Keep carts in Redis\s*Accepted\s*2026-02-01/,
      /^shop:0001\s*Keep carts in Postgres\s*Superseded\s*2025-05-02/,
    ]);
    await expect(rows.nth(2)).toHaveAttribute("data-superseded", "true");
    await expect(rows.nth(1)).not.toHaveAttribute("data-superseded", "true");
  });

  test("an ADR opens in the reader with its status, date, people, links and rendered body, and a link opens its Saved View", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout&sel=shop:cart");
    await panel(page).getByRole("tab", { name: "ADRs" }).click();
    await panel(page).getByRole("button", { name: /Keep carts in Redis/ }).click();

    await expect(reader(page).getByRole("heading", { level: 2 })).toHaveText("Keep carts in Redis");
    expect(hash(page)).toBe("#/view/c2?open=shop:checkout&sel=shop:cart&adr=shop:0002");
    const facts = reader(page).getByRole("definition");
    await expect(reader(page).getByRole("term")).toHaveText(["Status", "Date", "Decision makers", "Consulted", "Tags", "Elements", "Views", "Supersedes"]);
    await expect(facts.nth(0)).toHaveText("Accepted");
    await expect(facts.nth(1)).toHaveText("2026-02-01");
    await expect(facts.nth(2)).toHaveText("storefront-team, Ana");

    const body = reader(page).getByRole("region", { name: "Decision" });
    await expect(body.getByRole("heading", { level: 3 })).toHaveText(["Context and Problem Statement", "Decision Outcome"]);
    await expect(body.getByRole("listitem")).toHaveText(["reads stay under 5 ms", "carts expire on their own"]);
    await expect(body.locator("strong")).toHaveText("Postgres");
    await expect(body.locator("pre code")).toHaveText("ttl: 7d");
    await expect(body.getByRole("link", { name: "the Redis docs" })).toHaveAttribute("href", "https://redis.io/docs/");
    await expect(body.getByRole("heading", { name: "Keep carts in Redis" })).toHaveCount(0);

    await reader(page).getByRole("button", { name: "Cart flow" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/shop:cart-flow");
    await expect(node(page, "shop:cart")).toBeVisible();
    await expect(reader(page)).toHaveCount(0);

    await page.goBack();
    await settled(page);
    await expect(reader(page).getByRole("heading", { level: 2 })).toHaveText("Keep carts in Redis");
  });

  test("an ADR's Element link selects the Element, and a Deployment Target is named", async ({ page }) => {
    await open(page, "#/view/c2?adr=shop:0002");
    await expect(reader(page).getByText("EKS prod")).toBeVisible();
    await reader(page).getByRole("button", { name: "Cart", exact: true }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2?sel=shop:cart");
    await expect(panel(page)).toBeVisible();
  });

  test("Close and Escape shut the reader and keep the selection", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout&sel=shop:cart&adr=shop:0002");
    await reader(page).getByRole("button", { name: "Close ADR" }).click();
    await expect(reader(page)).toHaveCount(0);
    expect(hash(page)).toBe("#/view/c2?open=shop:checkout&sel=shop:cart");

    await open(page, "#/view/c2?adr=shop:0002");
    await page.keyboard.press("Escape");
    await expect(reader(page)).toHaveCount(0);
  });
});

test.describe("A superseded ADR", () => {
  test("shows its effective status beside its own, and links to its successor", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout&sel=shop:cart&adr=shop:0001");
    await expect(reader(page).getByRole("heading", { level: 2 })).toHaveText("Keep carts in Postgres");
    await expect(reader(page).getByRole("status")).toHaveText(/Superseded by shop:0002 Keep carts in Redis/);
    const facts = reader(page).getByRole("definition");
    await expect(reader(page).getByRole("term").first()).toHaveText("Status");
    await expect(facts.first()).toHaveText("Superseded (written as Accepted)");

    await reader(page).getByRole("button", { name: "shop:0002 Keep carts in Redis" }).first().click();
    await expect(reader(page).getByRole("heading", { level: 2 })).toHaveText("Keep carts in Redis");
    expect(hash(page)).toBe("#/view/c2?open=shop:checkout&sel=shop:cart&adr=shop:0002");
  });

  test("an unknown ADR id says so", async ({ page }) => {
    await open(page, "#/view/c2?adr=shop:0099");
    await expect(reader(page)).toContainText("No ADR shop:0099");
  });
});
