import { expect, test, type Page } from "@playwright/test";
import { hash, node, open, renderedGeometry, settled } from "./support.ts";

/** The Element panel shown while something is selected. */
const panel = (page: Page) => page.getByRole("complementary", { name: "Element" });
const picked = (page: Page) => page.locator('[data-node][data-picked="true"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-node")!).sort());
/** Whether box `a` lies inside box `b` on screen. */
const inside = (a: DOMRect | { x: number; y: number; width: number; height: number }, b: typeof a) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.width <= b.x + b.width + 0.5 && a.y + a.height <= b.y + b.height + 0.5;

test.describe("Solutions Architect: where is a Service deployed?", () => {
  test("Where is it deployed? opens the Environment's Deployment View with the Service's Deployments marked, inside their Targets", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout");
    await node(page, "shop:cart").click();
    const where = panel(page).getByRole("region", { name: "Where is it deployed?" });
    await expect(where.getByRole("button")).toHaveText(["Production", "Staging"]);
    await where.getByRole("button", { name: "Production" }).click();
    await settled(page);

    expect(hash(page)).toBe("#/view/deployment/prod?picks=shop:cart@platform:eks-prod");
    await expect(page.getByRole("navigation", { name: "Breadcrumbs" })).toContainText("Production (Deployment)");
    expect(await picked(page)).toEqual(["shop:cart@platform:eks-prod"]);
    await expect(node(page, "payments:payments-api@platform:eks-prod")).not.toHaveAttribute("data-picked", "true");
    await expect(page.getByRole("group", { name: "Direction" }).getByRole("button", { name: "TB" })).toHaveAttribute("aria-pressed", "true");

    // The Deployment sits in its System's box, inside the cluster, inside the region.
    const boxes = new Map((await renderedGeometry(page)).nodes.map((n) => [n.id, n]));
    const chain = ["shop:cart@platform:eks-prod", "shop:checkout@platform:eks-prod", "platform:eks-prod", "platform:aws-eu"];
    for (let i = 0; i + 1 < chain.length; i++) expect(inside(boxes.get(chain[i]!)!, boxes.get(chain[i + 1]!)!), `${chain[i]} in ${chain[i + 1]}`).toBe(true);
    await expect(node(page, "platform:eks-prod")).toContainText("cluster");

    // Selecting the Deployment shows its Service, with the URL for that Environment.
    await node(page, "shop:cart@platform:eks-prod").click();
    await expect(panel(page).getByRole("heading", { name: "Cart" })).toBeVisible();
    await panel(page).getByRole("tab", { name: "URLs" }).click();
    await expect(panel(page).getByRole("region", { name: "Production" })).toContainText("https://cart.shop.example.com");
  });

  test("the link survives a reload and Back returns to where the question was asked", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout&sel=shop:cart");
    await panel(page).getByRole("region", { name: "Where is it deployed?" }).getByRole("button", { name: "Staging" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/deployment/staging?picks=shop:cart@platform:eks-staging");

    await page.reload();
    await settled(page);
    expect(await picked(page)).toEqual(["shop:cart@platform:eks-staging"]);
    await page.goBack();
    await settled(page);
    expect(hash(page)).toBe("#/view/c2?open=shop:checkout&sel=shop:cart");
  });

  test("Deployment links next to the breadcrumbs open each Environment's Deployment View", async ({ page }) => {
    await open(page, "#/view/c2");
    const links = page.getByRole("navigation", { name: "Deployment Views" });
    await expect(links.getByRole("link")).toHaveText(["Production", "Staging"]);
    await links.getByRole("link", { name: "Staging" }).click();
    await settled(page);

    expect(hash(page)).toBe("#/view/deployment/staging");
    await expect(links.getByRole("link", { name: "Staging" })).toHaveAttribute("aria-current", "page");
    await expect(node(page, "shop:cart@platform:eks-staging")).toBeVisible();
  });

  test("a Service with no Deployments says so instead", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout&sel=shop:cart-db");
    await expect(panel(page).getByRole("region", { name: "Where is it deployed?" })).toContainText("Not deployed");
  });

  test("the Views tree lists one Deployment View per Environment", async ({ page }) => {
    await open(page, "#/view/c2");
    await page.getByRole("navigation", { name: "Rail" }).getByRole("button", { name: "Views" }).click();
    const views = page.getByRole("dialog", { name: "Views" });
    await views.getByRole("button", { name: "Expand Deployment" }).click();
    await views.getByRole("button", { name: "Production (Deployment)" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/deployment/prod");
  });
});
