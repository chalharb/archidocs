import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

describe("src/commands/", () => {
  it("is imported only through its index from outside", () => {
    const { stdout } = spawnSync("git", ["grep", "-nE", String.raw`from "[^"]*commands/[a-z-]+\.ts"`, "--", ":!src/commands/"], { cwd: repoRoot, encoding: "utf8" });
    const deep = stdout.split("\n").filter((line) => line && !/commands\/index\.ts"/.test(line));

    expect(deep).toEqual([]);
  });
});
