import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { nodeFileSystem } from "../../src/core/index.ts";
import { write } from "../../src/writer/index.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { writeWorkspace } from "../support/workspace.ts";

it("refuses a write when another process changed the file after the edit was planned", async () => {
  const { repoRoot, root } = await writeWorkspace(validWorkspace);
  const target = join(root, "shop/services.yaml");
  const theirs = "services:\n  search:\n    name: Search\n";
  const real = nodeFileSystem();
  // Load reads the target, planning reads it again, and the third read is the writer's re-read before writing: by then another process has replaced it.
  let reads = 0;
  const fs = {
    ...real,
    readFile: async (path: string) => {
      if (path === target) reads++;
      if (path === target && reads === 3) await writeFile(target, theirs);
      return real.readFile(path);
    },
  };

  const request = { op: "upsert-element", project: "shop", kind: "service", id: "web", fields: { name: "Storefront" } } as const;
  const result = await write({ fs, root, repoRoot }, request);

  expect(result).toMatchObject({ ok: false, code: "validation_failed" });
  expect(reads).toBe(3);
  expect(await readFile(target, "utf8")).toBe(theirs);
});
