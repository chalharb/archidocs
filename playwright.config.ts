import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Workspaces served to the E2E suite:
 *  - acme:    the sample workspace, read-only
 *  - scratch: a fresh writable copy of the sample (scripts/e2e-workspaces.ts)
 *  - docs:    another writable copy, for documentation tests that edit files
 *  - visual:  committed visual-regression fixture (tests/fixtures/visual)
 *  - large:   the generated medium benchmark workspace
 */
export const E2E_WORKSPACES = [
  "acme=examples/sample-workspace",
  "scratch=.e2e-workspaces/scratch",
  "docs=.e2e-workspaces/docs",
  "visual=tests/fixtures/visual",
  "large=.e2e-workspaces/large",
].join(",");

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // Visual regression (LAYER-07): fixed viewport, static animations, deterministic fixtures.
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.002 },
  },
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}-{platform}{ext}",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: "en-GB",
    timezoneId: "UTC",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    // Requires `pnpm build` first (CI runs it as a separate gate).
    command: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e-workspaces.ts && pnpm exec next start -H 127.0.0.1 -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/workspaces`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { ARCHIDOC_WATCH: "1", ARCHIDOC_WORKSPACES: E2E_WORKSPACES },
  },
});
