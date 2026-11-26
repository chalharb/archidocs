import { expect, test } from "@playwright/test";
import { hash, node, nodeIds, open, settled } from "./support.ts";

test.describe("the URL holds the screen", () => {
  test("opening a copied link restores the same View, open boxes, selection and direction", async ({ page, context, browser }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page, "#/view/c2");
    await page.getByRole("button", { name: "Collapse Payments" }).click();
    await settled(page);
    await page.getByRole("button", { name: "Expand Cart" }).click();
    await settled(page);
    // Open, Cart holds its Components; its name is clear of them.
    await node(page, "shop:cart").getByTestId("name").click();
    await page.getByLabel("Direction").selectOption("TB");
    await settled(page);
    await page.getByRole("button", { name: "Copy link" }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());

    const other = await browser.newPage();
    await other.goto(link);
    await settled(other);

    expect(link).toBe(page.url());
    expect(await nodeIds(other)).toEqual(await nodeIds(page));
    expect(link).toContain("closed=payments:payments");
    await expect(other.getByRole("region", { name: "Open boxes" }).getByRole("button", { name: "Close Cart" })).toBeVisible();
    await expect(node(other, "payments:payments-api")).toHaveCount(0);
    await expect(node(other, "shop:cart")).toHaveAttribute("aria-selected", "true");
    await expect(other.getByLabel("Direction")).toHaveValue("TB");
    await other.close();
  });

  test("back and forward walk View and open-box changes, while selection replaces the current entry", async ({ page }) => {
    await open(page, "#/view/c2");
    await page.getByRole("button", { name: "Expand Cart" }).click();
    await settled(page);
    // Open, Cart holds its Components; its name is clear of them.
    await node(page, "shop:cart").getByTestId("name").click();
    const openWithCart = hash(page);
    await node(page, "shop:cart").getByTestId("name").dblclick();
    await settled(page);
    expect(hash(page)).toMatch(/^#\/view\/c3\/shop:cart/);

    await page.goBack();
    await settled(page);
    expect(hash(page)).toBe(openWithCart);
    await expect(node(page, "shop:cart")).toHaveAttribute("aria-selected", "true");

    await page.goBack();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2");
    await expect(node(page, "shop:checkout-ui")).toHaveCount(0);

    await page.goForward();
    await settled(page);
    expect(hash(page)).toBe(openWithCart);
    await expect(node(page, "shop:checkout-ui")).toBeVisible();
  });

  test("an empty hash opens the C1 Landscape", async ({ page }) => {
    await page.goto("./");
    await settled(page);
    // The hash stays empty; the screen is the C1 Landscape all the same.
    await expect(page.getByRole("navigation", { name: "Breadcrumbs" })).toHaveText("C1");
    expect(await nodeIds(page)).toContain("shop:checkout");
  });

  test("an unknown View says so and links home", async ({ page }) => {
    await page.goto("./#/view/c2/shop:nope");
    await expect(page.getByText("No View c2/shop:nope")).toBeVisible();
    await page.getByRole("link", { name: "Open the C1 Landscape" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c1");
  });

  test("the logo goes home to the C1 Landscape, and Back returns", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout&sel=shop:cart&impact=shop:cart&way=both");
    const before = hash(page);
    await page.getByRole("link", { name: "Archidocs home" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c1");
    await page.goBack();
    await settled(page);
    expect(hash(page)).toBe(before);
  });

  test("Recent lists the last places, newest first, and reopens them", async ({ page }) => {
    await open(page, "#/view/c1");
    await open(page, "#/view/c2/shop:checkout");
    await open(page, "#/view/c3/shop:cart");
    await page.getByRole("button", { name: "Recent" }).click();
    const recent = page.getByRole("menu", { name: "Recent" });
    await expect(recent.getByRole("menuitem")).toHaveText(["Cart (C3)", "Checkout (C2)", "C1 Landscape"]);

    await recent.getByRole("menuitem", { name: "Checkout (C2)" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2/shop:checkout");
  });

  test("Recent keeps the last 10 places, one per View and open boxes", async ({ page }) => {
    const places = [
      "c1",
      "c2",
      "c2/shop:checkout",
      "c2/payments:payments",
      "c3/shop:cart",
      "c3/payments:payments-api",
      "c2?open=shop:checkout",
      "c2?open=shop:checkout&sel=shop:cart",
      "c2?open=payments:payments",
      "c2?open=shop:checkout,payments:payments",
      "c2?open=shop:checkout,shop:cart",
      "c2/shop:checkout?open=shop:cart",
    ];
    for (const place of places) await open(page, `#/view/${place}`);
    await page.getByRole("button", { name: "Recent" }).click();
    const items = page.getByRole("menu", { name: "Recent" }).getByRole("menuitem");
    await expect(items).toHaveCount(10);
    await expect(items.first()).toHaveText("Checkout (C2) · 1 open");
    await expect(items.filter({ hasText: "C1 Landscape" })).toHaveCount(0);
    await items.filter({ hasText: "C2 Landscape · 1 open" }).first().click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2?open=payments:payments");
  });
});

test.describe("where am I", () => {
  test("breadcrumbs walk up the scope ladder", async ({ page }) => {
    await open(page, "#/view/c3/shop:cart");
    const crumbs = page.getByRole("navigation", { name: "Breadcrumbs" });
    await expect(crumbs.getByRole("listitem")).toHaveText(["C1", "C2 Landscape", "Checkout", "Cart"]);
    await expect(crumbs.getByRole("listitem").last()).toHaveAttribute("aria-current", "page");

    await crumbs.getByRole("link", { name: "Checkout" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2/shop:checkout");
    await crumbs.getByRole("link", { name: "C1" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c1");
  });

  test("chips show the open boxes; ✕ closes one, Collapse all closes them all", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:cart,payments:payments-api");
    const chips = page.getByRole("region", { name: "Open boxes" });
    await expect(chips.getByRole("button", { name: /^Close / })).toHaveText(["Cart", "Payments API"]);

    await chips.getByRole("button", { name: "Close Payments API" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2?open=shop:cart");
    await expect(node(page, "payments:charges")).toHaveCount(0);

    await chips.getByRole("button", { name: "Collapse all" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2");
    await expect(chips).toBeHidden();
  });

  test("on the C2 Landscape a System's chip closes it into closed=", async ({ page }) => {
    await open(page, "#/view/c2?open=payments:payments");
    await page.getByRole("region", { name: "Open boxes" }).getByRole("button", { name: "Close Payments" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2?closed=payments:payments");
    await expect(node(page, "payments:payments-api")).toHaveCount(0);
  });
});

test.describe("the rail", () => {
  test("the Model tree groups by kind, nests Services in Systems, and focuses a pick", async ({ page }) => {
    await open(page, "#/view/c2?closed=shop:checkout");
    await page.getByRole("button", { name: "Model" }).click();
    const flyout = page.getByRole("dialog", { name: "Model" });
    const tree = flyout.getByRole("tree");
    await expect(tree.getByRole("treeitem", { level: 1 })).toHaveText([/^People/, /^Systems/, /^Services/]);

    await tree.getByRole("treeitem", { name: /^Systems/ }).getByRole("button", { name: "Expand Systems" }).click();
    await tree.getByRole("treeitem", { name: /^Checkout/ }).getByRole("button", { name: "Expand Checkout" }).click();
    await tree.getByRole("button", { name: "Fraud check", exact: true }).click();

    await expect(flyout).toBeHidden();
    await settled(page);
    // Picking it opens its closed System again.
    expect(hash(page)).toBe("#/view/c2?sel=shop:fraud-check");
    await expect(node(page, "shop:fraud-check")).toHaveAttribute("aria-selected", "true");
  });

  test("the Model tree by Team lists what each Team owns, an Element under its own Team, and skips Teams that own none", async ({ page }) => {
    await open(page, "#/view/c2");
    await page.getByRole("button", { name: "Model" }).click();
    const tree = page.getByRole("dialog", { name: "Model" }).getByRole("tree");
    await page.getByRole("dialog", { name: "Model" }).getByRole("radio", { name: "By Team" }).check();
    await expect(tree.getByRole("treeitem", { level: 1 })).toHaveText([/^Payments/, /^Storefront/]);

    const payments = tree.getByRole("treeitem", { name: /^Payments/, level: 1 });
    await payments.getByRole("button", { name: "Expand Payments" }).first().click();
    await expect(payments.getByRole("treeitem", { level: 2 })).toHaveText([/^Fraud check/, /^Payments/]);
  });

  test("the Views tree nests C3 Views under their System and opens a pick", async ({ page }) => {
    await open(page, "#/view/c1");
    await page.getByRole("button", { name: "Views" }).click();
    const flyout = page.getByRole("dialog", { name: "Views" });
    const tree = flyout.getByRole("tree");
    await expect(tree.getByRole("treeitem", { level: 1 })).toHaveText([/^Landscapes/, /^Systems/, /^Deployment/, /^Saved Views/]);

    await tree.getByRole("treeitem", { name: /^Systems/ }).getByRole("button", { name: "Expand Systems" }).click();
    await tree.getByRole("treeitem", { name: /^Checkout/ }).getByRole("button", { name: "Expand Checkout" }).click();
    await tree.getByRole("button", { name: "Cart (C3)" }).click();

    await expect(flyout).toBeHidden();
    await settled(page);
    expect(hash(page)).toBe("#/view/c3/shop:cart");
  });

  test("the Views tree by Team puts the Landscapes under Workspace, then each Team's Views", async ({ page }) => {
    await open(page, "#/view/c1");
    await page.getByRole("button", { name: "Views" }).click();
    const flyout = page.getByRole("dialog", { name: "Views" });
    await flyout.getByRole("radio", { name: "By Team" }).check();
    await expect(flyout.getByRole("tree").getByRole("treeitem", { level: 1 })).toHaveText([/^Workspace/, /^Payments/, /^Storefront/]);
  });

  test("the current scope's branch opens and is tinted", async ({ page }) => {
    await open(page, "#/view/c3/shop:cart");
    await page.getByRole("button", { name: "Views" }).click();
    const current = page.getByRole("dialog", { name: "Views" }).getByRole("button", { name: "Cart (C3)" });
    await expect(current).toBeVisible();
    await expect(current).toHaveAttribute("aria-current", "page");
  });

  test("Escape closes a flyout", async ({ page }) => {
    await open(page, "#/view/c1");
    await page.getByRole("button", { name: "Views" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Views" })).toBeHidden();
  });
});
