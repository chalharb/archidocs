import { expect, test, type Page } from "@playwright/test";
import { formatPlace } from "../viewer/src/place.ts";
import { WORKED_LINKS } from "../website/src/reference/viewer-urls.ts";
import { PORT, SITES } from "./sites.ts";
import { hash, node, open } from "./support.ts";

// The docs' viewer URL reference links into the live Big Bank demo. Each link is opened here on a build of the same demo.
test.use({ baseURL: `http://127.0.0.1:${PORT}${SITES.bigBank}` });

const panel = (page: Page) => page.getByRole("complementary", { name: "Element" });
const lens = (page: Page) => page.getByRole("region", { name: "Lens" });

/** What each worked link must show, by its hash: the screen its row on the reference page describes. */
const shows: Record<string, (page: Page) => Promise<void>> = {
  "#/view/c2?from=digital:spa&to=core:mainframe": async (page) => {
    await expect(lens(page)).toContainText("Paths from Single-Page Application to Mainframe");
  },
  "#/view/deployment/prod?sel=payments:payments-service@platform:eks-prod": async (page) => {
    await expect(page.getByRole("navigation", { name: "Breadcrumbs" })).toContainText("Production (Deployment)");
    await expect(panel(page).getByRole("heading", { name: "Payments Service" })).toBeVisible();
  },
  "#/view/c2?team=payments": async (page) => {
    await expect(lens(page)).toContainText("Team Payments");
  },
  "#/view/c2?impact=core:mainframe&way=upstream": async (page) => {
    await expect(lens(page)).toContainText("Impact of Mainframe, upstream");
  },
  "#/view/c2?open=payments:payments&sel=payments:payments-service": async (page) => {
    await expect(panel(page).getByRole("heading", { name: "Payments Service" })).toBeVisible();
    await panel(page).getByRole("tab", { name: "URLs" }).click();
    await expect(panel(page).getByRole("region", { name: "Production" })).toContainText("https://payments.bigbank.example");
  },
  "#/view/c2?adr=digital:0002": async (page) => {
    await expect(page.getByRole("article", { name: "ADR" })).toContainText("Delegate sign-in to the Identity Platform");
  },
  "#/view/c2?vs=2025-07-21": async (page) => {
    await expect(page.getByRole("button", { name: "Clear compare" })).toBeVisible();
    await expect(node(page, "payments:payments")).toHaveAttribute("data-change", "added");
    await expect(node(page, "payments:card-network")).toHaveAttribute("data-change", "added");
  },
};

test("every worked link on the viewer URL reference has a check here", () => {
  expect(WORKED_LINKS.map((l) => formatPlace(l.place)).sort()).toEqual(Object.keys(shows).sort());
});

for (const link of WORKED_LINKS) {
  const h = formatPlace(link.place);
  test(`${link.who}: ${link.question} ${h}`, async ({ page }) => {
    await open(page, h);
    expect(hash(page)).toBe(h);
    await shows[h]!(page);
  });
}
