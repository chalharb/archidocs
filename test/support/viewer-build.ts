import { build } from "vite";
import { fileURLToPath } from "node:url";

/** Vitest global setup: builds the viewer into dist/viewer, as `pnpm build` does, so `build --out` has assets to copy. */
export default async function setup() {
  await build({ configFile: fileURLToPath(new URL("../../viewer/vite.config.ts", import.meta.url)), logLevel: "warn" });
}
