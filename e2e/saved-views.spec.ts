import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { expect, test, type Download, type Page } from "@playwright/test";
import { parse } from "yaml";
import { load, nodeFileSystem, resolveView } from "../src/core/index.ts";
import { checkoutSource, createServer } from "../src/mcp/index.ts";
import { viewerWorkspace } from "../test/support/fixtures.ts";
import { writeWorkspace, type Files } from "../test/support/workspace.ts";
import { hash, node, nodeIds, open, settled } from "./support.ts";

const views = (page: Page) => page.getByRole("dialog", { name: "Views" });
const hits = (page: Page) => page.locator('[data-node][data-hit="true"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-node")!).sort());

async function savedYamlAndCall(page: Page, id: string, title: string) {
  await page.getByRole("button", { name: "Save as View" }).click();
  const dialog = page.getByRole("dialog", { name: "Save as View" });
  await dialog.getByLabel("Project").selectOption("shop");
  await dialog.getByLabel("Id").fill(id);
  await dialog.getByLabel("Title").fill(title);
  const yaml = (await dialog.getByLabel("YAML", { exact: true }).textContent())!;
  const call = JSON.parse((await dialog.getByLabel("upsert_view call", { exact: true }).textContent())!) as { tool: string; arguments: { project: string; id: string; definition: Record<string, unknown> } };
  return { yaml, call };
}

/** The node ids the core engine resolves a Saved View to, from the fixture Workspace with `extra` files added. */
async function resolvedIds(extra: Files, id: string): Promise<string[]> {
  const { repoRoot, root } = await writeWorkspace({ ...viewerWorkspace, ...extra });
  const { bundle, issues } = await load({ fs: nodeFileSystem(), root, repoRoot });
  expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  return resolveView(bundle, id)!.nodes.map((n) => n.id).sort();
}

/** Runs the upsert_view call against a checkout of the fixture Workspace through MCP, then resolves what it wrote. */
async function upsertedIds(call: { tool: string; arguments: Record<string, unknown> }, id: string): Promise<string[]> {
  const { repoRoot, root } = await writeWorkspace(viewerWorkspace);
  const server = createServer({ source: checkoutSource({ root }) });
  const client = new Client({ name: "e2e", version: "0.0.0" });
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  await client.connect(clientSide);
  try {
    const result = await client.callTool({ name: call.tool, arguments: call.arguments });
    expect(result.isError ?? false).toBe(false);
  } finally {
    await client.close();
  }
  const { bundle } = await load({ fs: nodeFileSystem(), root, repoRoot });
  return resolveView(bundle, id)!.nodes.map((n) => n.id).sort();
}

const text = async (download: Download) => readFile((await download.path())!, "utf8");

async function exportAs(page: Page, item: string): Promise<Download> {
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menu", { name: "Export" }).getByRole("menuitem", { name: item }).click()]);
  return download;
}

test.describe("Saved Views in the Views tree", () => {
  test("are grouped by Project, and open with their Lens, which can be cleared", async ({ page }) => {
    await open(page, "#/view/c2");
    await page.getByRole("button", { name: "Views" }).click();
    const tree = views(page).getByRole("tree");
    await tree.getByRole("button", { name: "Expand Saved Views" }).click();
    await tree.getByRole("button", { name: "Expand Shop" }).click();
    await tree.getByRole("button", { name: "Checkout impact" }).click();
    await settled(page);

    expect(hash(page)).toBe("#/view/shop:checkout-impact?impact=shop:cart&way=upstream");
    await expect(page.getByRole("navigation", { name: "Breadcrumbs" }).getByRole("listitem")).toHaveText(["Saved", "Shop", "Checkout impact"]);
    expect(await nodeIds(page)).toEqual(["shop:cart", "shop:cart-db", "shop:checkout", "shop:fraud-check", "shop:order-history", "shop:shopper", "shop:web"]);
    expect(await hits(page)).toEqual(["shop:cart", "shop:shopper", "shop:web"]);

    await page.getByRole("button", { name: "Clear lens" }).click();
    await settled(page);
    expect(hash(page)).toBe("#/view/shop:checkout-impact");
    await expect(page.locator("[data-node][data-hit]")).toHaveCount(0);
  });

  test("by Team, sit under the Team owning their Project", async ({ page }) => {
    await open(page, "#/view/c2");
    await page.getByRole("button", { name: "Views" }).click();
    await views(page).getByRole("radio", { name: "By Team" }).check();
    const tree = views(page).getByRole("tree");
    await tree.getByRole("button", { name: "Expand Storefront" }).click();
    await expect(tree.getByRole("button", { name: "Checkout impact" })).toBeVisible();
  });
});

test.describe("Picks", () => {
  test("shift-click picks nodes, counted in a chip", async ({ page }) => {
    await open(page, "#/view/c2");
    await node(page, "shop:web").click({ modifiers: ["Shift"] });
    await node(page, "shop:shopper").click({ modifiers: ["Shift"] });
    await expect(page.getByRole("region", { name: "Picks" })).toContainText("2 picked");
    expect(hash(page)).toBe("#/view/c2?picks=shop:web,shop:shopper");
  });
});

test.describe("Export", () => {
  test("the whole View as SVG matches archidocs export for the same View", async ({ page }) => {
    await open(page, "#/view/c2");
    const download = await exportAs(page, "View as SVG");
    expect(download.suggestedFilename()).toBe("c2.svg");
    expect(await text(download)).toBe(await (await page.request.get("./expected/c2.svg")).text());
  });

  test("a Saved View keeps its Lens in the SVG, as archidocs export draws it", async ({ page }) => {
    await open(page, "#/view/shop:checkout-impact?impact=shop:cart&way=upstream");
    const download = await exportAs(page, "View as SVG");
    expect(download.suggestedFilename()).toBe("shop-checkout-impact.svg");
    expect(await text(download)).toBe(await (await page.request.get("./expected/shop-checkout-impact.svg")).text());
  });

  test("the picks as SVG are laid out again with their open containers", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout&picks=shop:cart,shop:web");
    const svg = await text(await exportAs(page, "Picks as SVG"));
    for (const name of ["Cart", "Web"]) expect(svg).toContain(`>${name}</text>`);
    expect(svg).toContain(">Checkout · System</text>");
    for (const name of ["Shopper", "Payments", "Cart DB"]) expect(svg).not.toContain(`>${name}</text>`);
  });

  test("PNG is a PNG", async ({ page }) => {
    await open(page, "#/view/c1");
    const download = await exportAs(page, "View as PNG");
    expect(download.suggestedFilename()).toBe("c1.png");
    const bytes = await readFile((await download.path())!);
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });
});

test.describe("Save as View", () => {
  test("open boxes and an Impact Lens give YAML that resolves to the screen's nodes", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout&impact=shop:cart&way=upstream");
    const { yaml, call } = await savedYamlAndCall(page, "cart-upstream", "Cart upstream");

    const definition = parse(yaml).views.structural["cart-upstream"];
    expect(definition).toMatchObject({ title: "Cart upstream", level: "c2", expand: ["checkout"], lens: { impact: "cart", direction: "upstream" } });
    expect(definition.include).toContainEqual({ element: "cart", upstream: "all" });
    expect(call).toEqual({ tool: "upsert_view", arguments: { project: "shop", id: "cart-upstream", definition } });

    const screen = await nodeIds(page);
    expect(await resolvedIds({ "shop/saved.yaml": yaml }, "shop:cart-upstream")).toEqual(screen);
    expect(await upsertedIds(call, "shop:cart-upstream")).toEqual(screen);
  });

  test("picks and a Team Lens give YAML that resolves to the picks and their containers", async ({ page }) => {
    await open(page, "#/view/c2?open=shop:checkout&team=payments-team");
    await node(page, "shop:fraud-check").click({ modifiers: ["Shift"] });
    await node(page, "payments:payments").click({ modifiers: ["Shift"] });
    const { yaml } = await savedYamlAndCall(page, "fraud", "Fraud");

    expect(parse(yaml).views.structural.fraud.include).toContainEqual({ team: "payments-team" });
    expect(await resolvedIds({ "shop/saved.yaml": yaml }, "shop:fraud")).toEqual(["payments:payments", "shop:checkout", "shop:fraud-check"]);
  });

  test("Connect to… becomes a path selector", async ({ page }) => {
    await open(page, "#/view/c2?sel=shop:web");
    await page.getByRole("complementary", { name: "Element" }).getByRole("button", { name: "Connect to…" }).click();
    await node(page, "payments:payments").click();
    await settled(page);
    const { yaml } = await savedYamlAndCall(page, "web-to-payments", "Web to Payments");
    const screenPicks = ["payments:payments", "shop:checkout", "shop:web"];
    expect(parse(yaml).views.structural["web-to-payments"].include).toContainEqual({ from: "web", to: "payments:payments", paths: "shortest" });
    expect(await resolvedIds({ "shop/saved.yaml": yaml }, "shop:web-to-payments")).toEqual(screenPicks);
  });

  test("a Deployment View saves whole over its Environment, and with picks says to clear them", async ({ page }) => {
    await open(page, "#/view/deployment/prod");
    const { yaml, call } = await savedYamlAndCall(page, "prod", "Prod");
    expect(parse(yaml).views.structural.prod).toEqual({ title: "Prod", level: "deployment", environment: "prod" });
    const screen = (await nodeIds(page)).sort();
    expect(await resolvedIds({ "shop/saved.yaml": yaml }, "shop:prod")).toEqual(screen);
    expect(await upsertedIds(call, "shop:prod")).toEqual(screen);
    await page.keyboard.press("Escape");

    await open(page, "#/view/deployment/prod?picks=shop:cart@platform:eks-prod");
    await page.getByRole("button", { name: "Save as View" }).click();
    const dialog = page.getByRole("dialog", { name: "Save as View" });
    await expect(dialog.getByRole("alert")).toHaveText("Save as View keeps a whole Deployment View; clear the picks first.");
    await expect(dialog.getByLabel("YAML", { exact: true })).toHaveCount(0);
  });
});

