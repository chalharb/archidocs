import { defineConfig, devices } from "@playwright/test";

const ROOT_PORT = 4173;
const SUB_PORT = 4174;
export const SUB_PATH = "/.notes/archi/";

const server = (dir: string, port: number, mount: string) => ({
  command: `node tests/support/static-server.mjs ${dir} ${port} ${mount}`,
  url: `http://localhost:${port}/__health`,
  reuseExistingServer: !process.env["CI"],
});

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  reporter: process.env["CI"] ? [["html", { open: "never" }], ["list"]] : "list",
  webServer: [server(".e2e/root", ROOT_PORT, "/"), server(".e2e/sub", SUB_PORT, SUB_PATH)],
  projects: [
    {
      name: "served-at-root",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${ROOT_PORT}/` },
    },
    {
      name: "served-under-sub-path",
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${SUB_PORT}${SUB_PATH}` },
    },
  ],
});
