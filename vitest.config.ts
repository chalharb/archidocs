import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli/index.ts"],
      reporter: ["text-summary", "lcov", "json-summary"],
      thresholds: { statements: 85, branches: 75, functions: 85, lines: 85 },
    },
  },
});
