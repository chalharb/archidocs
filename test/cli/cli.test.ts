import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { commandList, EXIT, NO_WORKSPACE } from "../../src/cli/commands.ts";
import { findWorkspaceRoot, type FileSystem } from "../../src/core/index.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { archidocs } from "../support/cli.ts";
import { writeWorkspace } from "../support/workspace.ts";

// Two errors in two files; every format test runs against this one fixture.
const broken = {
  ...validWorkspace,
  "shop/more.yaml": "services:\n  cart:\n    name: Cart\n    owner: storefront\n",
  "shop/services.yaml": "services:\n  web:\n    name: Web\n    techology: Next.js\n",
};

const unknownTeam = {
  file: "archidocs/shop/more.yaml",
  line: 4,
  column: 12,
  rule: "unknown-team",
  severity: "error",
  message: 'Unknown Team "storefront"; did you mean "storefront-team"?',
};
const unknownField = {
  file: "archidocs/shop/services.yaml",
  line: 4,
  column: 5,
  rule: "unknown-field",
  severity: "error",
  message: 'Unknown field "techology"; did you mean "technology"?',
};

describe("archidocs CLI", () => {
  it("version prints the package version and the Bundle schemaVersion, which CI cache keys use", async () => {
    const { repoRoot } = await writeWorkspace(validWorkspace);
    const pkg = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));

    const text = await archidocs(repoRoot, "version");
    const json = await archidocs(repoRoot, "version", "--format", "json");

    expect(text).toMatchObject({ code: 0, stdout: `archidocs ${pkg.version} (Bundle schemaVersion 1)\n` });
    expect(json.code).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({ version: pkg.version, schemaVersion: 1 });
  });

  it("check prints issues as text grouped by file, with a summary, and exits 1 on errors", async () => {
    const { repoRoot } = await writeWorkspace(broken);
    const { code, stdout } = await archidocs(join(repoRoot, "archidocs", "shop"), "check");

    expect(code).toBe(1);
    expect(stdout).toBe(
      [
        'archidocs/shop/more.yaml:4:12  error  unknown-team  Unknown Team "storefront"; did you mean "storefront-team"?',
        "",
        'archidocs/shop/services.yaml:4:5  error  unknown-field  Unknown field "techology"; did you mean "technology"?',
        "",
        "2 errors, 0 warnings",
        "",
        "Rule docs:",
        "  unknown-team  https://archidocs.dev/docs/reference/rules/unknown-team/",
        "  unknown-field  https://archidocs.dev/docs/reference/rules/unknown-field/",
        "",
      ].join("\n"),
    );
  });

  it("check --format text is the default and has colour only when asked to colour", async () => {
    const { repoRoot } = await writeWorkspace(broken);
    const piped = await archidocs(repoRoot, "check", "--format", "text");
    const forced = await archidocs(repoRoot, { FORCE_COLOR: "1" }, "check");

    expect(piped.stdout).toBe((await archidocs(repoRoot, "check")).stdout);
    expect(piped.stdout).not.toContain("\x1b[");
    expect(forced.stdout).toContain("\x1b[31merror\x1b[0m");
  });

  it("check --format json prints the issue records and a summary", async () => {
    const { repoRoot } = await writeWorkspace(broken);
    const { code, stdout } = await archidocs(repoRoot, "check", "--format", "json");

    expect(code).toBe(1);
    const docs = (rule: string) => `https://archidocs.dev/docs/reference/rules/${rule}/`;
    expect(JSON.parse(stdout)).toEqual({ issues: [unknownTeam, unknownField].map((i) => ({ ...i, docs: docs(i.rule) })), summary: { errors: 2, warnings: 0 } });
  });

  it("check --format github prints a workflow command per issue", async () => {
    const { repoRoot } = await writeWorkspace(broken);
    const { code, stdout } = await archidocs(repoRoot, "check", "--format", "github");

    expect(code).toBe(1);
    expect(stdout).toBe(
      '::error file=archidocs/shop/more.yaml,line=4,col=12,title=unknown-team::Unknown Team "storefront"; did you mean "storefront-team"? See https://archidocs.dev/docs/reference/rules/unknown-team/\n' +
        '::error file=archidocs/shop/services.yaml,line=4,col=5,title=unknown-field::Unknown field "techology"; did you mean "technology"? See https://archidocs.dev/docs/reference/rules/unknown-field/\n',
    );
  });

  it("check --format github escapes workflow-command delimiters in properties", async () => {
    const { repoRoot } = await writeWorkspace({ ...validWorkspace, "shop/odd,name.yaml": "services:\n  cart:\n    name: Cart\n    owner: storefront\n" });
    const { stdout } = await archidocs(repoRoot, "check", "--format", "github");

    expect(stdout).toBe(
      '::error file=archidocs/shop/odd%2Cname.yaml,line=4,col=12,title=unknown-team::Unknown Team "storefront"; did you mean "storefront-team"? See https://archidocs.dev/docs/reference/rules/unknown-team/\n',
    );
  });

  it("check --strict exits 0 on a valid Workspace and 1 on errors", async () => {
    const valid = await writeWorkspace(validWorkspace);
    const invalid = await writeWorkspace(broken);

    expect((await archidocs(valid.repoRoot, "check", "--strict")).code).toBe(0);
    expect((await archidocs(invalid.repoRoot, "check", "--strict")).code).toBe(1);
  });

  it.each([
    ["an unknown flag", ["check", "--bogus"]],
    ["an unknown format", ["check", "--format", "sarif"]],
    ["a missing format value", ["check", "--format"]],
    ["an unknown command", ["chek"]],
  ])("check exits 2 on %s, with usage on stderr", async (_, args) => {
    const { repoRoot } = await writeWorkspace(validWorkspace);
    const { code, stdout, stderr } = await archidocs(repoRoot, ...args);

    expect(code).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toContain("Usage:");
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

// The CLI reference prints each command's exit codes from its definition; these hold the definitions to what the CLI does.
describe("the exit codes the command definitions list", () => {
  const listing = (code: number) => commandList.filter((c) => c.exitCodes.some((e) => e.code === code)).map((c) => c.name);

  it.each(commandList.map((c) => c.name))("%s exits 2 on a flag it does not take, with usage on stderr", async (name) => {
    const { repoRoot } = await writeWorkspace(validWorkspace);
    const { code, stderr } = await archidocs(repoRoot, ...name.split(" "), "--no-such-flag");

    expect(code).toBe(EXIT.couldNotRun);
    expect(stderr).toContain("Usage:");
    expect(listing(EXIT.couldNotRun)).toContain(name);
  });

  it("check, gaps, build and export exit 1 on a Workspace with errors, and only they list 1", async () => {
    const { repoRoot } = await writeWorkspace(broken);
    const runs = { check: ["check"], gaps: ["gaps"], build: ["build", "--bundle-only", "--out", "out"], export: ["export", "c1"] };

    for (const args of Object.values(runs)) expect((await archidocs(repoRoot, ...args)).code, args.join(" ")).toBe(EXIT.foundErrors);
    expect(listing(EXIT.foundErrors)).toEqual(Object.keys(runs));
  });

  it("a command that needs a Workspace exits 2 with the message the reference quotes when there is none", async () => {
    const { repoRoot } = await writeWorkspace({});
    const { code, stderr } = await archidocs(repoRoot, "export", "c1");

    expect(code).toBe(EXIT.couldNotRun);
    expect(stderr).toContain(`archidocs: ${NO_WORKSPACE}\nUsage:`);
  });
});

describe("how the Workspace is found", () => {
  it("looks in a folder, then its archidocs/ folder, then the same in each folder above, up to the root", async () => {
    const looked: string[] = [];
    const nothing = { exists: async (path: string) => (looked.push(path), false) } as unknown as FileSystem;

    expect(await findWorkspaceRoot(nothing, join(sep, "repo", "shop"))).toBeUndefined();
    expect(looked).toEqual([
      join(sep, "repo", "shop", "workspace.yaml"),
      join(sep, "repo", "shop", "archidocs", "workspace.yaml"),
      join(sep, "repo", "workspace.yaml"),
      join(sep, "repo", "archidocs", "workspace.yaml"),
      join(sep, "workspace.yaml"),
      join(sep, "archidocs", "workspace.yaml"),
    ]);
  });

  it("takes the first workspace.yaml it finds: a folder's own before the one in its archidocs/ folder", async () => {
    const both = { exists: async (path: string) => path.endsWith("workspace.yaml") && path.startsWith(join(sep, "repo")) } as unknown as FileSystem;
    const nested = { exists: async (path: string) => path === join(sep, "repo", "archidocs", "workspace.yaml") } as unknown as FileSystem;

    expect(await findWorkspaceRoot(both, join(sep, "repo"))).toBe(join(sep, "repo"));
    expect(await findWorkspaceRoot(nested, join(sep, "repo", "archidocs", "shop"))).toBe(join(sep, "repo", "archidocs"));
    expect(await findWorkspaceRoot(nested, join(sep, "repo"))).toBe(join(sep, "repo", "archidocs"));
  });
});
