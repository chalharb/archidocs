import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

const alias = { "@": path.resolve(import.meta.dirname, "src") };

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/components/ui/**", // generated shadcn primitives
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx", // exercised by Playwright, not Vitest
        "src/app/**/diagram-page.tsx", // shared server page body, exercised by Playwright
        "src/app/**/route.ts", // thin adapters; handlers are tested in src/server/http
        "src/instrumentation.ts",
        "src/**/*.d.ts",
      ],
      reporter: ["text-summary", "text", "json-summary", "html"],
      thresholds: {
        // PRD §7: overall 85% / branch 85%; critical domain logic 95%.
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 85,
        "src/domain/**": { lines: 95, statements: 95, functions: 95, branches: 95 },
        "src/server/persistence/**": { lines: 95, statements: 95, functions: 95, branches: 95 },
        "src/server/fs/**": { lines: 95, statements: 95, functions: 95, branches: 95 },
        "src/server/workspace/{loader,snapshot}.ts": {
          lines: 95,
          statements: 95,
          functions: 95,
          branches: 95,
        },
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
          exclude: ["**/*.integration.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.integration.test.ts", "tests/integration/**/*.test.ts"],
          exclude: ["tests/integration/performance.test.ts"],
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
      {
        // PERF-04 budgets time real work, so they run alone after every other project
        // (higher groupOrder) instead of competing for CPU with parallel test files.
        resolve: { alias },
        test: {
          name: "performance",
          environment: "node",
          include: ["tests/integration/performance.test.ts"],
          testTimeout: 60_000,
          hookTimeout: 20_000,
          sequence: { groupOrder: 1 },
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "component",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./tests/setup/component.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "bench",
          environment: "node",
          include: [],
          benchmark: {
            include: ["tests/bench/**/*.bench.ts"],
            outputJson: "bench-results/latest.json",
          },
        },
      },
    ],
  },
});
