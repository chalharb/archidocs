import { expect, test, type Page } from "@playwright/test";
import { hash, node, open, settled } from "./support.ts";

/** The Element panel shown while something is selected. */
const panel = (page: Page) => page.getByRole("complementary", { name: "Element" });
/** The ids of the nodes a Lens hits, sorted. */
const hits = (page: Page) => page.locator('[data-node][data-hit="true"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-node")!).sort());
/** The edges a Lens lights, as `from>to`, sorted. */
const lit = (page: Page) => page.locator('path[data-edge-from][data-lit="true"]').evaluateAll((els) => els.map((e) => `${e.getAttribute("data-edge-from")}>${e.getAttribute("data-edge-to")}`).sort());

async function find(page: Page, query: string) {
  await page.keyboard.press("/");
  const box = page.getByRole("dialog", { name: "Find" }).getByRole("searchbox");
  await expect(box).toBeFocused();
  await box.fill(query);
  return page.getByRole("dialog", { name: "Find" }).getByRole("option");
}

test.describe("Product Owner: what is upstream and downstream of an outage?", () => {
  test("an Impact Lens from the Element panel badges each node with its distance and lights only edges one hop closer", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout");
    await node(page, "shop:cart").click();
    await panel(page).getByRole("button", { name: "Both ways impact" }).click();
    await settled(page);
    await page.getByRole("region", { name: "Lens" }).getByRole("group", { name: "Impact direction" }).getByRole("button", { name: "Upstream" }).click();
    await settled(page);

    await expect(page.getByRole("region", { name: "Lens" })).toContainText("Impact of Cart, upstream");
    expect(await hits(page)).toEqual(["shop:cart", "shop:shopper", "shop:web"]);
    await expect(node(page, "shop:web").getByTestId("distance")).toHaveText("1");
    await expect(node(page, "shop:shopper").getByTestId("distance")).toHaveText("2");
    await expect(node(page, "shop:cart-db")).toHaveAttribute("data-hit", "false");
    expect(await lit(page)).toEqual(["shop:shopper>shop:web", "shop:web>shop:cart"]);
  });

  test("a collapsed box is marked when anything inside it is hit, with the nearest distance", async ({ page }) => {
    await open(page, "#/view/c2?closed=shop:checkout,payments:payments&impact=shop:cart&way=downstream");
    await expect(node(page, "shop:checkout")).toHaveAttribute("data-hit", "true");
    await expect(node(page, "shop:checkout").getByTestId("distance")).toHaveText("0");
    await expect(node(page, "payments:payments")).toHaveAttribute("data-hit", "true");
    await expect(node(page, "shop:shopper")).toHaveAttribute("data-hit", "false");
  });

  test("the Lens survives a reload, and ✕ clears it with a history entry", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout&sel=shop:cart");
    await panel(page).getByRole("button", { name: "Both ways impact" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2?open=shop:checkout&sel=shop:cart&impact=shop:cart&way=both");

    await page.reload();
    await settled(page);
    await expect(page.getByRole("region", { name: "Lens" })).toContainText("Impact of Cart, both ways");
    await expect(node(page, "shop:cart-db").getByTestId("distance")).toHaveText("1");

    await page.getByRole("button", { name: "Clear lens" }).click();
    await settled(page);
    await expect(page.getByRole("region", { name: "Lens" })).toHaveCount(0);
    await expect(page.locator("[data-node][data-hit]")).toHaveCount(0);
    await page.goBack();
    await settled(page);
    await expect(page.getByRole("region", { name: "Lens" })).toBeVisible();
  });
});

test.describe("Enterprise Architect: how are two Services connected?", () => {
  test("Connect to… lights the shortest paths to the node clicked next and picks the nodes on them", async ({ page }) => {
    await open(page, "#/view/c2?closed=shop:checkout,payments:payments");
    await node(page, "shop:web").click();
    await panel(page).getByRole("button", { name: "Connect to…" }).click();
    await expect(page.getByRole("status")).toContainText("Pick the node to connect Web to");
    await node(page, "payments:payments").click();
    await settled(page);

    await expect(page.getByRole("region", { name: "Lens" })).toContainText("Paths from Web to Payments");
    expect(await hits(page)).toEqual(["payments:payments", "shop:checkout", "shop:web"]);
    // Edges are marked lit once React Flow has drawn them, which can trail the nodes under load.
    await expect.poll(() => lit(page)).toEqual(["shop:checkout>payments:payments", "shop:web>shop:checkout"]);
    await expect(page.getByRole("region", { name: "Picks" })).toContainText("3 picked");
    for (const id of ["payments:payments", "shop:checkout", "shop:web"]) await expect(node(page, id)).toHaveAttribute("data-picked", "true");
    await expect(node(page, "shop:shopper")).not.toHaveAttribute("data-picked", "true");

    await page.getByRole("region", { name: "Lens" }).getByRole("button", { name: "All ≤ 4 hops" }).click();
    await settled(page);
    expect(hash(page)).toContain("paths=4");
    await page.reload();
    await settled(page);
    await expect(page.getByRole("region", { name: "Lens" }).getByRole("button", { name: "All ≤ 4 hops" })).toHaveAttribute("aria-pressed", "true");
    expect(await hits(page)).toEqual(["payments:payments", "shop:checkout", "shop:web"]);
  });

  test("the end node can be found with Find instead of clicked", async ({ page }) => {
    await open(page, "#/view/c2?sel=shop:web");
    await panel(page).getByRole("button", { name: "Connect to…" }).click();
    const options = await find(page, "Payments");
    await options.filter({ hasText: "Payments" }).first().click();
    await settled(page);
    await expect(page.getByRole("region", { name: "Lens" })).toContainText("Paths from Web to Payments");
  });
});

test.describe("Developer: what does my Team own?", () => {
  test("a Team Lens from the Teams list rings owned nodes, and collapsed boxes holding them", async ({ page }) => {
    await open(page, "#/view/c2?closed=shop:checkout,payments:payments");
    await page.getByRole("navigation", { name: "Rail" }).getByRole("button", { name: "Teams" }).click();
    await page.getByRole("dialog", { name: "Teams" }).getByRole("button", { name: /Payments/ }).click();
    await settled(page);

    expect(hash(page)).toBe("#/view/c2?closed=shop:checkout,payments:payments&team=payments-team");
    await expect(page.getByRole("region", { name: "Lens" })).toContainText("Team Payments");
    expect(await hits(page)).toEqual(["payments:payments", "shop:checkout"]);
    await expect(node(page, "payments:payments")).toHaveClass(/arc-ringed/);
  });

  test("the Owner chip in the Element panel opens the Team Lens", async ({ page }) => {
    await open(page, "#/view/c2?sel=shop:fraud-check");
    await panel(page).getByRole("button", { name: "Team lens: Payments" }).click();
    await settled(page);
    expect(await hits(page)).toEqual(["payments:payments", "payments:payments-api", "shop:fraud-check"]);
  });
});

test.describe("QA Tester: what is a Service's URL in an Environment?", () => {
  test("Find matches a URL; the URLs tab lists each Environment and Target with copy buttons and named endpoints", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page, "#/view/c2");
    const options = await find(page, "cart.staging.shop.example.com");
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText("https://cart.staging.shop.example.com");
    await options.first().click();
    await settled(page);
    await expect(node(page, "shop:cart")).toHaveAttribute("aria-selected", "true");
    expect(hash(page)).toBe("#/view/c2?sel=shop:cart");

    await panel(page).getByRole("tab", { name: "URLs" }).click();
    const prod = panel(page).getByRole("region", { name: "Production" });
    await expect(prod).toContainText("AWS eu-west-1 › EKS prod");
    await expect(prod).toContainText("https://cart.shop.example.com");
    await expect(prod).toContainText("health");
    await expect(panel(page).getByRole("region", { name: "Staging" })).toContainText("https://cart.staging.shop.example.com");

    await prod.getByRole("button", { name: "Copy https://cart.shop.example.com", exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://cart.shop.example.com");
  });
});

test.describe("Find", () => {
  test("matches name, id, Team and technology", async ({ page }) => {
    await open(page, "#/view/c2");
    await expect((await find(page, "kafka")).first()).toContainText("Events");
    await page.getByRole("dialog", { name: "Find" }).getByRole("searchbox").fill("payments-team");
    await expect(page.getByRole("dialog", { name: "Find" }).getByRole("option").filter({ hasText: "Fraud check" })).toHaveCount(1);
    await page.getByRole("dialog", { name: "Find" }).getByRole("searchbox").fill("shop:cart-db");
    await expect(page.getByRole("dialog", { name: "Find" }).getByRole("option").first()).toContainText("Cart DB");
  });

  test("its close button closes it", async ({ page }) => {
    await open(page, "#/view/c2");
    await find(page, "kafka");
    await page.getByRole("dialog", { name: "Find" }).getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog", { name: "Find" })).toHaveCount(0);
  });

  test("focusing a result stays in the current View when it can, and Enter picks the first", async ({ page }) => {
    await open(page, "#/view/c2/shop:checkout");
    await find(page, "Cart DB");
    await page.keyboard.press("Enter");
    await settled(page);
    expect(hash(page)).toBe("#/view/c2/shop:checkout?sel=shop:cart-db");
    await expect(page.getByRole("dialog", { name: "Find" })).toHaveCount(0);
  });
});

test.describe("the Element panel", () => {
  test("Overview shows description and technology; it closes when nothing is selected", async ({ page }) => {
    await open(page, "#/view/c2?sel=shop:events");
    await expect(panel(page).getByRole("heading", { name: "Events" })).toBeVisible();
    await expect(panel(page)).toContainText("Kafka");
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await expect(panel(page)).toHaveCount(0);
  });

  test("Links lists Relationships, Downstream and Upstream, and a link focuses that Element", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout&sel=shop:cart");
    await panel(page).getByRole("tab", { name: "Links" }).click();
    await expect(panel(page).getByRole("region", { name: "Relationships" })).toContainText("Reads and writes carts");
    await expect(panel(page).getByRole("region", { name: "Downstream" })).toContainText("Cart DB");
    await expect(panel(page).getByRole("region", { name: "Upstream" })).toContainText("Web");
    await panel(page).getByRole("region", { name: "Upstream" }).getByRole("button", { name: "Web" }).click();
    await expect(node(page, "shop:web")).toHaveAttribute("aria-selected", "true");
  });
});

test("a lit edge stays lit while a node is selected", async ({ page }) => {
  await open(page, "#/view/c2?closed=shop:checkout,payments:payments&sel=shop:web&from=shop:web&to=payments:payments");
  await expect(page.locator('path[data-edge-from="shop:checkout"][data-edge-to="payments:payments"]')).not.toHaveClass(/arc-faded/);
  await expect(page.locator('path[data-edge-from="shop:shopper"][data-edge-to="shop:web"]')).toHaveClass(/arc-faded/);
});
