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
    await expect(page.getByLabel("Direction")).toHaveValue("TB");

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

  test("a Saved Deployment View with no direction of its own lays out top to bottom, as `archidocs export` draws it", async ({ page }) => {
    await open(page, "#/view/shop:staging-deployment");
    await expect(page.getByLabel("Direction")).toHaveValue("TB");
    // Web calls Cart: top to bottom puts the caller above the Deployment it calls.
    const boxes = new Map((await renderedGeometry(page)).nodes.map((n) => [n.id, n]));
    const [web, cart] = [boxes.get("shop:web")!, boxes.get("shop:cart@platform:eks-staging")!];
    expect(web.y + web.height).toBeLessThan(cart.y);
  });

  test("a Deployment in a Saved Deployment View shows the URL of that View's Environment", async ({ page }) => {
    // Payments API runs on EKS prod in both Environments; only its staging Deployment has a URL.
    await open(page, "#/view/shop:staging-deployment");
    await expect(node(page, "payments:payments-api@platform:eks-prod")).toContainText("payments.staging.example.com");
    await open(page, "#/view/deployment/prod");
    await expect(node(page, "payments:payments-api@platform:eks-prod")).toContainText("EKS prod");
  });
});

/** Opens the canvas Key, if it is folded. */
async function openKey(page: Page) {
  const key = page.locator(".arc-key");
  if ((await key.getAttribute("open")) === null) await key.locator("summary").click();
}

test.describe("a scaled Deployment", () => {
  test("draws as a stack with its count chip, `×3` fixed or `2–10` autoscale, and the Key explains the stack", async ({ page }) => {
    await open(page, "#/view/deployment/prod");
    const scaled = node(page, "payments:payments-api@platform:eks-prod");
    await expect(scaled.getByTestId("instances")).toHaveText("×3");
    // The stack sits behind the box: its two copies are offset down and to the right.
    const stack = scaled.locator("xpath=preceding-sibling::*[@data-testid='stack']");
    await expect(stack).toHaveCount(1);
    expect(await stack.evaluate((el) => [getComputedStyle(el, "::before").transform, getComputedStyle(el, "::after").transform])).toEqual(["matrix(1, 0, 0, 1, 10, 10)", "matrix(1, 0, 0, 1, 5, 5)"]);
    // An unscaled Deployment has neither.
    const plain = node(page, "shop:cart@platform:eks-prod");
    await expect(plain.getByTestId("instances")).toHaveCount(0);
    await expect(plain.locator("xpath=preceding-sibling::*[@data-testid='stack']")).toHaveCount(0);
    await openKey(page);
    await expect(page.getByTestId("key-scaled")).toContainText("Stacked: scaled");

    await open(page, "#/view/deployment/staging");
    await expect(node(page, "payments:payments-api@platform:eks-prod").getByTestId("instances")).toHaveText("2–10");
  });

  test("leaves the Key's stack row out of a View with no scaled Deployment", async ({ page }) => {
    await open(page, "#/view/c1");
    await openKey(page);
    await expect(page.getByTestId("key-scaled")).toHaveCount(0);
  });
});
