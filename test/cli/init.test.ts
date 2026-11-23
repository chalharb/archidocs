import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { archidocs } from "../support/cli.ts";

const skillDirs = [".agents/skills", ".claude/skills", ".github/skills"];

async function emptyRepo() {
  const repo = await mkdtemp(join(tmpdir(), "archidocs-init-"));
  execFileSync("git", ["init", "--quiet"], { cwd: repo });
  return repo;
}

const read = (repo: string, path: string) => readFile(join(repo, path), "utf8");

describe("archidocs init", () => {
  it("scaffolds a Workspace that checks clean, installs the skill stub and points AGENTS.md at it", async () => {
    const repo = await emptyRepo();
    const { code, stdout } = await archidocs(repo, "init");
    expect(code).toBe(0);

    expect(existsSync(join(repo, "archidocs/workspace.yaml"))).toBe(true);
    expect(await read(repo, ".gitignore")).toContain(".archidocs/");
    for (const dir of skillDirs) {
      const stub = await read(repo, `${dir}/archidocs-authoring/SKILL.md`);
      expect(stub).toMatch(/^---\nname: archidocs-authoring\ndescription: .+\n---\n/);
      expect(stub).toContain("get_authoring_guide");
      expect(stub).toContain("archidocs guide");
    }
    const agents = await read(repo, "AGENTS.md");
    expect(agents).toContain("archidocs-authoring");
    expect(agents).toContain("`archidocs/`");
    expect(existsSync(join(repo, "CLAUDE.md"))).toBe(false);
    expect(stdout).toContain("archidocs mcp --workspace archidocs");

    expect((await archidocs(repo, "check")).code).toBe(0);
  });

  it("is safe to re-run: nothing is duplicated and an existing Workspace and AGENTS.md are kept", async () => {
    const repo = await emptyRepo();
    await writeFile(join(repo, "AGENTS.md"), "# My repo\n\nHouse rules.\n");
    await writeFile(join(repo, "CLAUDE.md"), "# Claude\n");
    await writeFile(join(repo, ".gitignore"), "node_modules/\n");
    await archidocs(repo, "init");
    await writeFile(join(repo, "archidocs/workspace.yaml"), "teams:\n  core:\n    name: Core\n");
    const first = {
      agents: await read(repo, "AGENTS.md"),
      claude: await read(repo, "CLAUDE.md"),
      gitignore: await read(repo, ".gitignore"),
      stub: await read(repo, ".claude/skills/archidocs-authoring/SKILL.md"),
    };

    const again = await archidocs(repo, "init");
    expect(again.code).toBe(0);
    expect(await read(repo, "AGENTS.md")).toBe(first.agents);
    expect(await read(repo, "CLAUDE.md")).toBe(first.claude);
    expect(await read(repo, ".gitignore")).toBe(first.gitignore);
    expect(await read(repo, ".claude/skills/archidocs-authoring/SKILL.md")).toBe(first.stub);
    expect(await read(repo, "archidocs/workspace.yaml")).toBe("teams:\n  core:\n    name: Core\n");

    expect(first.agents).toMatch(/^# My repo\n\nHouse rules\.\n\n/);
    expect(first.agents.match(/archidocs-authoring/g)).toHaveLength(1);
    expect(first.claude).toContain("archidocs-authoring");
    expect(first.gitignore).toBe("node_modules/\n.archidocs/\n");
  });

  it("uses the Workspace already found from the current folder", async () => {
    const repo = await emptyRepo();
    await mkdir(join(repo, "arch"), { recursive: true });
    await writeFile(join(repo, "arch/workspace.yaml"), "teams: {}\n");
    const { stdout } = await archidocs(join(repo, "arch"), "init");
    expect(existsSync(join(repo, "archidocs"))).toBe(false);
    expect(await read(repo, "AGENTS.md")).toContain("`arch/`");
    expect(stdout).toContain("archidocs mcp --workspace arch");
  });

  it("--skill in a code repo installs only the stub and pointer, with no Workspace", async () => {
    const repo = await emptyRepo();
    const { code, stdout } = await archidocs(repo, "init", "--skill");
    expect(code).toBe(0);
    expect(existsSync(join(repo, "archidocs"))).toBe(false);
    expect(existsSync(join(repo, ".gitignore"))).toBe(false);
    for (const dir of skillDirs) expect(existsSync(join(repo, `${dir}/archidocs-authoring/SKILL.md`))).toBe(true);
    expect(await read(repo, "AGENTS.md")).toContain("archidocs-authoring");
    expect(stdout).toContain("archidocs mcp --workspace <path-to-workspace-checkout>");
  });

  it("--skill --workspace prints the MCP command for that checkout", async () => {
    const repo = await emptyRepo();
    const { stdout } = await archidocs(repo, "init", "--skill", "--workspace", "../architecture/archidocs");
    expect(stdout).toContain("archidocs mcp --workspace ../architecture/archidocs");
  });
});
