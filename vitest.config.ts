import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/support/viewer-build.ts"],
    // CLI tests spawn the CLI and git several times per test. Under coverage
    // on a loaded CI runner (macOS) that passes 5s, so 5s only catches flakes.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // json-summary and json feed the PR coverage comment in CI.
      reporter: ["text", "json-summary", "json"],
      reportOnFailure: true,
    },
  },
});
