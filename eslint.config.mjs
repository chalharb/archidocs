import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const fsModules = ["fs", "fs/promises", "node:fs", "node:fs/promises", "chokidar"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
  {
    // SEC-09: filesystem access only through server-side repository services in src/server.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: fsModules.map((name) => ({
            name,
            message: "Filesystem access must go through src/server repository services (SEC-09).",
          })),
        },
      ],
    },
  },
  {
    // The pure domain layer must not depend on the server layer or Next.js.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: fsModules.map((name) => ({
            name,
            message: "src/domain must stay pure (no I/O).",
          })),
          patterns: [
            {
              group: ["@/server/*", "next", "next/*", "react"],
              message: "src/domain must stay pure.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "tests/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
