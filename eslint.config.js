import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", ".scratch/", "node_modules/", "test-results/", "playwright-report/", "examples/*/site/", "website/dist/", "website/.astro/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["viewer/**/*.{ts,tsx}"], ...reactHooks.configs.flat["recommended-latest"] },
  // The Revision index module is browser-safe: the viewer imports it.
  {
    files: ["src/revisions/**/*.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ regex: "^node:", message: "src/revisions/ is browser-safe; keep node: imports in src/history/." }] }] },
  },
);
