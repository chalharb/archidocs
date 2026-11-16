// Builds the package: viewer first, then the CLI bundle, then the config schema file.
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { createJiti } from "jiti";

/** @param {string} cmd @param {string[]} args */
const run = (cmd, args) =>
  execFileSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });

rmSync("dist", { recursive: true, force: true });
run("npx", ["vite", "build", "--config", "viewer/vite.config.ts"]);
run("npx", ["tsup"]);

const jiti = createJiti(import.meta.url);
const { configSchema } = /** @type {{ configSchema: unknown }} */ (
  await jiti.import("../src/core/config-schema.ts")
);
writeFileSync("dist/config.schema.json", `${JSON.stringify(configSchema, null, 2)}\n`);
