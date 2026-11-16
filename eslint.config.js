import js from "@eslint/js";
import playwright from "eslint-plugin-playwright";
import reactHooks from "eslint-plugin-react-hooks";
import vitest from "eslint-plugin-vitest";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "playwright-report", "test-results", ".e2e", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
  {
    files: ["viewer/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ["tests/unit/**/*.ts", "tests/pack/**/*.ts"],
    plugins: { vitest },
    rules: {
      "vitest/no-focused-tests": "error",
      "vitest/no-disabled-tests": "error",
    },
  },
  {
    ...playwright.configs["flat/recommended"],
    files: ["tests/e2e/**/*.ts"],
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      "playwright/no-focused-test": "error",
      "playwright/no-skipped-test": "error",
    },
  },
);
