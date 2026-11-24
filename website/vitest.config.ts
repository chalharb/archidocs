import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The build and fixture tests run whole site builds.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    // Astro keeps build state in website/.astro, so two builds at once would clash.
    fileParallelism: false,
  },
});
