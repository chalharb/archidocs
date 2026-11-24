import { defineConfig, devices } from "@playwright/test";
import { PORT, SITES } from "./e2e/sites.ts";
import { DOCS_PORT } from "./website/e2e/port.ts";

// Two projects:
// - viewer: the Viewer seam, against sites that `archidocs build --out` wrote from fixture Workspaces,
//   served under sub-paths as a Pages host would serve a project site.
// - website: the docs site (website/), built and served as static assets by website/e2e/serve.ts.
export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      testDir: "e2e",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 }, baseURL: `http://127.0.0.1:${PORT}${SITES.landscape}` },
    },
    {
      name: "website",
      testDir: "website/e2e",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 }, baseURL: `http://127.0.0.1:${DOCS_PORT}` },
    },
  ],
  webServer: [
    {
      command: "node e2e/serve.ts",
      url: `http://127.0.0.1:${PORT}${SITES.landscape}index.html`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
    },
    {
      command: "node website/e2e/serve.ts",
      url: `http://127.0.0.1:${DOCS_PORT}/docs/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
    },
  ],
});
