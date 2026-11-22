import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { validWorkspace } from "../support/fixtures.ts";
import { writeWorkspace } from "../support/workspace.ts";

const cli = fileURLToPath(new URL("../../src/cli/main.ts", import.meta.url));

async function archidocs(cwd: string, ...args: string[]) {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [cli, ...args], { cwd });
    return { code: 0, stdout, stderr };
  } catch (e) {
    const err = e as { code: number; stdout: string; stderr: string };
    return { code: err.code, stdout: err.stdout, stderr: err.stderr };
  }
}

const broken = { ...validWorkspace, "shop/more.yaml": "services:\n  cart:\n    name: Cart\n    owner: storefront\n" };

describe("archidocs CLI", () => {
  it("check prints issues as text and exits 1 on errors", async () => {
    const { repoRoot } = await writeWorkspace(broken);
    const { code, stdout } = await archidocs(join(repoRoot, "archidocs", "shop"), "check");

    expect(code).toBe(1);
    expect(stdout).toContain('archidocs/shop/more.yaml:4:12  error  unknown-team  Unknown Team "storefront"; did you mean "storefront-team"?');
    expect(stdout).toContain("1 error, 0 warnings");
  });

  it("check exits 0 on a valid Workspace, found from the repo root", async () => {
    const { repoRoot } = await writeWorkspace(validWorkspace);
    const { code, stdout } = await archidocs(repoRoot, "check");

    expect(code).toBe(0);
    expect(stdout).toContain("0 errors, 0 warnings");
  });

  it("check exits 2 when no workspace.yaml is found", async () => {
    const { repoRoot } = await writeWorkspace({});
    const { code, stderr } = await archidocs(repoRoot, "check");

    expect(code).toBe(2);
    expect(stderr).toContain("workspace.yaml");
  });

  it("build --bundle-only writes the Bundle for a valid Workspace", async () => {
    const { repoRoot } = await writeWorkspace(validWorkspace);
    const { code } = await archidocs(repoRoot, "build", "--bundle-only", "--out", "out");

    expect(code).toBe(0);
    const bundle = JSON.parse(await readFile(join(repoRoot, "out", "workspace.bundle.json"), "utf8"));
    expect(bundle.elements.map((e: { id: string }) => e.id)).toEqual(["payments:payments-api", "payments:stripe", "shop:orders-db", "shop:web"]);
  });

  it("build --bundle-only writes nothing when there is an error", async () => {
    const { repoRoot } = await writeWorkspace(broken);
    const { code, stdout } = await archidocs(repoRoot, "build", "--bundle-only", "--out", "out");

    expect(code).toBe(1);
    expect(stdout).toContain("unknown-team");
    expect(existsSync(join(repoRoot, "out"))).toBe(false);
  });
});
