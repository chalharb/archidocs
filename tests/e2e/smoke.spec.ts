import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("home page shows the example workspace as valid", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Architecture Docs");
    const heading = page.getByRole("heading", { level: 2, name: /ACME Payments Architecture/ });
    await expect(heading).toHaveCount(3); // the sample and its scratch and docs copies
    const card = page.locator('[data-slot="card"]', { hasText: "Workspace acme" });
    await expect(card.getByRole("heading", { level: 2 })).toContainText("Valid");
    await expect(card.getByText("No problems found.")).toBeVisible();
    await expect(card.getByRole("link", { name: "Production Deployment" })).toBeVisible();
  });

  test("home page has no automatically detectable accessibility violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("API serves the model and resolved diagrams", async ({ request }) => {
    const list = await request.get("/api/workspaces");
    expect(list.ok()).toBe(true);
    expect((await list.json()).workspaces[0]).toMatchObject({ key: "acme", status: "valid" });
    const diagram = await request.get("/api/workspaces/acme/diagrams/system-context");
    const body = await diagram.json();
    expect(body.layout.positions.customer).toMatchObject({ x: 300, y: 0, source: "manual" });
  });

  test("image route keeps its 4xx codes after a page has been rendered (SEC-12)", async ({
    page,
  }) => {
    // A page render creates the workspace service in the SSR bundle layer, so
    // the route handler sees FsErrors built by another module copy.
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Architecture Docs");
    const cases: [string, number, string][] = [
      ["docs/missing.png", 404, "NOT_FOUND"],
      ["workspace.yaml", 415, "UNSUPPORTED_TYPE"],
      [".git/x.png", 400, "INVALID_PATH"],
    ];
    for (const [file, status, code] of cases) {
      const res = await page.request.get(`/api/workspaces/acme/files/${file}`);
      expect(res.status(), file).toBe(status);
      expect(res.headers()["x-content-type-options"]).toBe("nosniff");
      expect((await res.json()).error.code, file).toBe(code);
    }
  });

  test("cross-origin writes are rejected (SEC-07)", async ({ request, baseURL }) => {
    const res = await request.put("/api/workspaces/acme/diagrams/containers/layout", {
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      data: { baseRevision: null, layout: {} },
    });
    expect(res.status()).toBe(403);
    const sameOrigin = await request.put("/api/workspaces/acme/diagrams/containers/layout", {
      headers: { origin: baseURL!, "content-type": "application/json" },
      data: { baseRevision: null, layout: { nodes: { ghost: { x: 0, y: 0 } } } },
    });
    expect(sameOrigin.status()).toBe(422); // passes the guard, fails validation; nothing written
  });

  test("non-loopback Host headers are rejected (SEC-10)", async ({ request }) => {
    const res = await request.get("/api/workspaces", {
      headers: { host: "attacker.example:3100" },
    });
    expect(res.status()).toBe(403);
    const page = await request.get("/", { headers: { host: "attacker.example" } });
    expect(page.status()).toBe(403);
  });
});
