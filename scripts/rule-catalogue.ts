// Regenerates docs/rules.md from the rule registry: `pnpm rules:catalogue`.
import { writeFile } from "node:fs/promises";
import { ruleCatalogue } from "../src/core/index.ts";

await writeFile(new URL("../docs/rules.md", import.meta.url), ruleCatalogue());
