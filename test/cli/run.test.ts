import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXIT } from "../../src/cli/commands.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { archidocs } from "../support/cli.ts";
import { writeWorkspace } from "../support/workspace.ts";

describe("run", () => {
  it("finds each call's own Workspace from its cwd when two run in parallel", async () => {
    const rename = (name: string) => ({ ...validWorkspace, "workspace.yaml": validWorkspace["workspace.yaml"]!.replace("name: Storefront", `name: ${name}`) });
    const [a, b] = await Promise.all([writeWorkspace(rename("Team Alpha")), writeWorkspace(rename("Team Beta"))]);
    const results = await Promise.all([a, b].map(({ repoRoot }) => archidocs(repoRoot, "build", "--bundle-only", "--out", "out")));
    expect(results.map((r) => r.code)).toEqual([EXIT.ok, EXIT.ok]);
    const [bundleA, bundleB] = await Promise.all([a, b].map(({ repoRoot }) => readFile(join(repoRoot, "out", "workspace.bundle.json"), "utf8")));
    expect(bundleA).toContain("Team Alpha");
    expect(bundleA).not.toContain("Team Beta");
    expect(bundleB).toContain("Team Beta");
    expect(bundleB).not.toContain("Team Alpha");
  });
});
