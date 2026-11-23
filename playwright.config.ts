import { defineConfig, devices } from "@playwright/test";
import { PORT, SITES } from "./e2e/sites.ts";

// The Viewer seam: Playwright against sites that `archidocs build --out` wrote from fixture Workspaces,
// served under sub-paths as a Pages host would serve a project site.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}${SITES.landscape}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } } }],
  webServer: {
    command: "node e2e/serve.ts",
    url: `http://127.0.0.1:${PORT}${SITES.landscape}index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
  },
});
