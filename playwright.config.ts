import { defineConfig, devices } from "@playwright/test";
import { PORT, SITES } from "./e2e/sites.ts";
import { DOCS_PORT } from "./website/e2e/port.ts";

// Two projects:
// - chromium: the Viewer seam, against sites that `archidocs build --out` wrote from fixture Workspaces,
//   served under sub-paths as a Pages host would serve a project site.
// - website: the docs site (website/), built and served as static assets by website/e2e/serve.ts.
// `pnpm test:e2e` runs both. E2E_PROJECT=chromium or website runs one and starts only its server, so CI
// runs them in separate jobs: the website one in the docs job, against the site that job already built.
const only = process.env.E2E_PROJECT;
const wanted = (project: string) => !only || only === project;

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
  ].filter(({ name }) => wanted(name)),
  // Each project's server, started only when that project runs.
  webServer: Object.entries({
    chromium: {
      command: "node e2e/serve.ts",
      url: `http://127.0.0.1:${PORT}${SITES.landscape}index.html`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe" as const,
    },
    website: {
      command: "node website/e2e/serve.ts",
      url: `http://127.0.0.1:${DOCS_PORT}/docs/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe" as const,
    },
  })
    .filter(([project]) => wanted(project))
    .map(([, server]) => server),
});
