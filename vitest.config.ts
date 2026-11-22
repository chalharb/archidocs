import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // json-summary and json feed the PR coverage comment in CI.
      reporter: ["text", "json-summary", "json"],
      reportOnFailure: true,
    },
  },
});
