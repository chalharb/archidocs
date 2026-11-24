import { expect, test } from "@playwright/test";

test("the landing page asks one question twice and both answers agree", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("One architecture. Same answer for people and agents.");
  await expect(page.getByRole("link", { name: "Open the Big Bank demo" }).first()).toHaveAttribute("href", "https://big-bank.archidocs.dev");
  await expect(page.getByRole("link", { name: "Read the quick start" }).first()).toHaveAttribute("href", "/docs/start/quick-start/");

  // The tool result is the real JSON, hidden until the call is expanded.
  const call = page.locator("details.call");
  const json = call.locator("pre.json");
  await expect(json).toBeHidden();
  await call.locator("summary").click();
  await expect(json).toBeVisible();
  // The JSON scrolls inside the agent's pane rather than widening it over the viewer's.
  const [agent, viewer] = await page.locator(".twin > .pane").evaluateAll((panes) => panes.map((p) => p.getBoundingClientRect().toJSON() as DOMRect));
  expect((await call.boundingBox())!.x + (await call.boundingBox())!.width).toBeLessThanOrEqual(agent!.right);
  expect(agent!.right).toBeLessThanOrEqual(viewer!.left);
  const result = JSON.parse((await json.textContent()) ?? "") as { id: string; direction: string; upstream: { total: number; rings: { elements: { name: string }[] }[] } };
  expect(result).toMatchObject({ id: "core:mainframe", direction: "upstream" });
  const total = result.upstream.total;
  expect(total).toBeGreaterThan(0);

  // The agent's reply and the viewer's lens count the same Elements as the result.
  await expect(call.locator("summary")).toContainText(`${total} upstream`);
  await expect(page.locator(".lens")).toContainText(`${total} upstream`);
  const names = result.upstream.rings.flatMap((r) => r.elements.map((e) => e.name));
  await expect(page.locator(".rings li")).toHaveText(names);

  // The diagram is the build's own export of the Saved View.
  const diagram = page.locator(".map img");
  await expect(diagram).toHaveAttribute("src", "/diagrams/big-bank/light/digital-mainframe-outage.svg");
  await expect.poll(() => diagram.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("link", { name: "Open this View live" })).toHaveAttribute("href", "https://big-bank.archidocs.dev/#/view/digital:mainframe-outage");
});

test("yellow marks only the viewer's you-are-here tile", async ({ page }) => {
  await page.goto("/");
  const yellow = await page.evaluate(() => {
    const here = "rgb(255, 198, 41)";
    return [...document.querySelectorAll("body *")]
      .filter((el) => {
        const s = getComputedStyle(el);
        return s.backgroundColor === here || s.color === here || (s.borderTopWidth !== "0px" && s.borderTopColor === here);
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
  });
  expect(yellow).toEqual(["span.here"]);
});

test("fonts and pictures come from the site itself", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (request) => hosts.add(new URL(request.url()).host));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('800 76px "Overpass"') && document.fonts.check('400 13px "Overpass Mono"'))).toBe(true);
  expect([...hosts]).toEqual([new URL(page.url()).host]);
});

test("each persona question links its MCP tools to their reference", async ({ page }) => {
  await page.goto("/");
  const rows = page.locator(".questions tbody tr");
  await expect(rows).toHaveCount(6);
  const link = rows.getByRole("link", { name: "get_impact" });
  await expect(link).toHaveAttribute("href", "/docs/reference/mcp/read-tools/#get_impact");
  await link.click();
  await expect(page.locator("#get_impact")).toBeVisible();
});

test("at 390 wide the page doesn't scroll sideways and the diagram does", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const map = page.locator(".map");
  expect(await map.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect(page.getByRole("link", { name: "Open the Big Bank demo" }).first()).toBeInViewport();
});
