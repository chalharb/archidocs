/**
 * Phase 2 documentation workflows (ADD-009): E2E-06..08, VR-10..11 and
 * accessibility of the documentation pages. File edits use the `docs`
 * workspace, a writable copy of the sample that no other spec touches.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ROOT, waitForDiagram, waitForQuiet } from "./helpers";

const DOCS_DIR = path.join(ROOT, ".e2e-workspaces/docs");
const ws = (key: string) => `/workspaces/${key}`;

test.describe("documentation (read-only)", () => {
  test("E2E-06: document → entity link → diagram → reverse reference back to the document", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Documents" }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Documents");
    await page.getByRole("link", { name: "Payments overview" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Payments overview");

    const article = page.getByRole("article", { name: "Payments overview" });
    await article.getByRole("link", { name: "Web Shop" }).click();
    await expect(page).toHaveURL(/\/diagrams\/containers\?focus=web-shop$/);
    await waitForDiagram(page);

    const inspector = page.getByRole("region", { name: "Web Shop" });
    await expect(inspector.getByRole("heading", { name: "Documentation" })).toBeVisible();
    await inspector.getByRole("link", { name: "Payments overview" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Payments overview");
  });

  test("E2E-07: filter the decision log and follow a supersession chain both ways", async ({
    page,
  }) => {
    await page.goto(`${ws("acme")}/decisions`);
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(3);
    // Newest first (ADR-04).
    await expect(rows.first()).toHaveAttribute("data-decision", "adr-0003");

    await page.getByLabel("Status").selectOption("superseded");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/status=superseded/);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute("data-decision", "adr-0001");

    await page.getByRole("link", { name: "Clear" }).click();
    await expect(page).toHaveURL(/\/decisions$/);
    await page.getByLabel("Entity").selectOption("payments-api");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute("data-decision", "adr-0002");

    await page.getByRole("link", { name: "Clear" }).click();
    await expect(page).toHaveURL(/\/decisions$/);
    await page.getByRole("link", { name: /Store the ledger in MongoDB/ }).click();
    await expect(page.getByText("This decision has been superseded")).toBeVisible();
    await page.getByRole("link", { name: "adr-0002: Use PostgreSQL for the ledger" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Use PostgreSQL for the ledger",
    );
    // The previous route stays mounted but hidden (cacheComponents), so check visibility.
    await expect(page.getByText("This decision has been superseded")).toBeHidden();
    await page.getByRole("link", { name: "adr-0001: Store the ledger in MongoDB" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Store the ledger in MongoDB",
    );
  });

  test("DOC-05: the diagram view lists the documentation that references it", async ({ page }) => {
    await page.goto(`${ws("acme")}/diagrams/containers`);
    await waitForDiagram(page);
    await page.getByText("Documentation (2)").click();
    await expect(page.getByRole("link", { name: "Payments overview" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "adr-0002: Use PostgreSQL for the ledger" }),
    ).toBeVisible();
  });

  for (const [name, url] of [
    ["document index", "/docs"],
    ["document", "/docs/payments-overview"],
    ["decision log", "/decisions"],
    ["decision", "/decisions/adr-0001"],
    ["entity", "/entities/ledger-db"],
  ] as const) {
    test(`${name} page has no automatically detectable accessibility violations`, async ({
      page,
    }) => {
      await page.goto(`${ws("acme")}${url}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("VR-10: document page", async ({ page }) => {
    await page.goto(`${ws("acme")}/docs/payments-overview`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Payments overview");
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("vr-10-document.png", { fullPage: false });
  });

  test("VR-11: decision page with a superseded banner", async ({ page }) => {
    await page.goto(`${ws("acme")}/decisions/adr-0001`);
    await expect(page.getByText("This decision has been superseded")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("vr-11-decision.png", { fullPage: false });
  });
});

test.describe("documentation live reload", () => {
  const file = path.join(DOCS_DIR, "decisions/adr-0003-async-fraud-checks.md");
  let original: string;
  test.beforeAll(async () => {
    original = await readFile(file, "utf8");
  });
  test.afterAll(async ({ request }) => {
    await writeFile(file, original);
    await waitForQuiet(request, "docs");
  });

  test("E2E-08: external edits reload the page; broken front matter keeps the last valid version", async ({
    page,
  }) => {
    await page.goto(`${ws("docs")}/decisions/adr-0003`);
    await expect(page.getByText("Proposed", { exact: true })).toBeVisible();

    await writeFile(file, original.replace("status: proposed", "status: accepted"));
    await expect(page.getByText("Accepted", { exact: true })).toBeVisible({ timeout: 10_000 });

    await writeFile(file, original.replace("status: proposed", "status: maybe"));
    await expect(page.getByText("Showing the last valid version")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
    await expect(page.getByText("SCHEMA_INVALID_VALUE")).toBeVisible();

    await writeFile(file, original);
    await expect(page.getByText("Showing the last valid version")).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(page.getByText("Proposed", { exact: true })).toBeVisible();
  });
});
