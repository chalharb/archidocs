import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { git, gitHead, gitTopLevel } from "../src/git.ts";
import { writeWorkspace } from "./support/workspace.ts";

describe("git runner", () => {
  it("gives null HEAD fields in a repo with no commits", async () => {
    const { repoRoot } = await writeWorkspace({});
    expect(await gitHead(repoRoot)).toEqual({ commit: null, builtAt: null });
  });

  it("gives a null top level outside git", async () => {
    const dir = await mkdtemp(join(tmpdir(), "archidocs-nogit-"));
    process.env.GIT_CEILING_DIRECTORIES = tmpdir();
    try {
      expect(await gitTopLevel(dir)).toBeNull();
    } finally {
      delete process.env.GIT_CEILING_DIRECTORIES;
    }
  });

  it("throws with git's own message on a bad ref", async () => {
    const { repoRoot } = await writeWorkspace({});
    await expect(git(repoRoot, "rev-parse", "--verify", "no-such-ref")).rejects.toThrow(/fatal: Needed a single revision/);
  });
});
