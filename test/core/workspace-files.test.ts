import { describe, expect, it } from "vitest";
import { isWorkspaceFile } from "../../src/core/workspace-files.ts";

describe("isWorkspaceFile", () => {
  it.each([
    ["workspace.yaml", true],
    ["shop/adr/0001-use-postgres.md", true],
    ["shop/model/deep/services.yaml", true],
    ["shop\\model\\services.yaml", true],
    ["shop/notes.json", false],
    ["shop/services.yml", false],
    [".hidden.yaml", false],
    ["shop/.services.yaml.swp", false],
    [".git/config.yaml", false],
    ["shop/.cache/services.yaml", false],
    ["node_modules/pkg/readme.md", false],
    ["shop\\node_modules\\x.yaml", false],
    ["shop\\.hidden\\x.yaml", false],
    ["", false],
  ])("%j is %s", (path, expected) => {
    expect(isWorkspaceFile(path)).toBe(expected);
  });
});
