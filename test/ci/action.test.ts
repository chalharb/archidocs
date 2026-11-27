import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const action = parse(readFileSync(new URL("../../action.yml", import.meta.url), "utf8"));
const script: string = action.runs.steps.find((s: { name?: string }) => s.name === "Install archidocs").run;

// Runs the install step with npm and pnpm stubbed to print their arguments.
function install(env: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "action-"));
  for (const tool of ["npm", "pnpm"]) {
    writeFileSync(join(dir, tool), `#!/bin/sh\necho "${tool} $*"\n`);
    chmodSync(join(dir, tool), 0o755);
  }
  return execFileSync("bash", ["-c", script], {
    encoding: "utf8",
    env: { PATH: `${dir}:${process.env.PATH}`, RUNNER_TEMP: dir, GITHUB_PATH: join(dir, "path"), GITHUB_ACTION_PATH: dir, VERSION: "", ACTION_REF: "", ...env },
  });
}

describe("the Action's install step", () => {
  it.each([["v1", "1"], ["v1.4", "1.4"], ["v1.4.0", "1.4.0"]])("installs %s from npm", (ref, version) => {
    const out = install({ ACTION_REF: ref });
    expect(out).toContain(`npm install --global archidocs@${version}`);
    expect(out).not.toContain("pnpm");
  });

  it("lets the version input win over the tag", () => {
    expect(install({ ACTION_REF: "v1", VERSION: "1.2.0" })).toContain("archidocs@1.2.0");
  });

  it.each(["", "beta", "main", "v1-beta", "1a2b3c4d5e6f", "v1.2.3.4"])("builds from source at ref %j", (ref) => {
    const out = install({ ACTION_REF: ref });
    expect(out).toContain("pnpm build");
    expect(out).not.toContain("archidocs@");
  });
});
