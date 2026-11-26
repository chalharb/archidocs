import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { findWorkspaceRoot, nodeFileSystem } from "../core/index.ts";
import { SKILL_NAME, skillStub } from "../guide/index.ts";

/** Where coding agents look for skills; the stub goes into each. */
export const SKILL_DIRS = [".agents/skills", ".claude/skills", ".github/skills"] as const;

const STARTER_WORKSPACE = `# The Archidocs Workspace root: Teams and Environments are defined here only.
# Each Project is a folder below this one holding a project.yaml.
teams: {}
environments: {}
`;

/** The local history cache, kept out of git. */
const CACHE_IGNORE = ".archidocs/";

export interface InitOptions {
  /** The repo being set up: its git top level, or the current folder outside git. */
  repoRoot: string;
  cwd: string;
  /** `init --skill`: a code repo, so install only the stub and pointer. */
  skillOnly: boolean;
  /** For `--skill`: the Workspace checkout to print in the MCP command. */
  workspace?: string;
  /** The environment init ran in, to tell a package runner from a global bin. */
  env: Record<string, string | undefined>;
  /** The archidocs version running init, pinned in the on-demand command. */
  version: string;
}

/**
 * The command that runs archidocs in this repo, as ADR 0001 decides it: the
 * local copy when `package.json` lists archidocs, a pinned on-demand npx when
 * init itself ran through a package runner, else the global bin.
 */
export async function archidocsCommand(repoRoot: string, env: Record<string, string | undefined>, version: string): Promise<string> {
  if (await listsArchidocs(join(repoRoot, "package.json"))) return "npx archidocs";
  if (env.npm_config_user_agent) return `npx -y archidocs@${version}`;
  return "archidocs";
}

async function listsArchidocs(path: string): Promise<boolean> {
  if (!existsSync(path)) return false;
  try {
    const manifest = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    return ["dependencies", "devDependencies", "optionalDependencies"].some((field) => {
      const deps = manifest[field];
      return typeof deps === "object" && deps !== null && "archidocs" in deps;
    });
  } catch {
    return false;
  }
}

/**
 * `archidocs init` and `init --skill`. Safe to re-run: an existing Workspace
 * and existing pointers are left alone, and the stub is rewritten as is.
 * Returns the lines to print.
 */
export async function init({ repoRoot, cwd, skillOnly, workspace, env, version }: InitOptions): Promise<string[]> {
  const out: string[] = [];
  const runner = await archidocsCommand(repoRoot, env, version);
  const stub = skillStub(runner);
  const wrote = (path: string, what: string) => out.push(`${what} ${posix(relative(repoRoot, path))}`);

  let workspaceDir: string | undefined;
  if (!skillOnly) {
    workspaceDir = (await findWorkspaceRoot(nodeFileSystem(), cwd)) ?? undefined;
    if (!workspaceDir) {
      workspaceDir = join(repoRoot, "archidocs");
      await mkdir(workspaceDir, { recursive: true });
      await writeFile(join(workspaceDir, "workspace.yaml"), STARTER_WORKSPACE);
      wrote(join(workspaceDir, "workspace.yaml"), "Wrote");
    }
    if (await appendOnce(join(repoRoot, ".gitignore"), CACHE_IGNORE, (text) => text.split(/\r?\n/).includes(CACHE_IGNORE), { create: true })) {
      wrote(join(repoRoot, ".gitignore"), "Updated");
    }
  }

  for (const dir of SKILL_DIRS) {
    const path = join(repoRoot, dir, SKILL_NAME, "SKILL.md");
    const before = existsSync(path) ? await readFile(path, "utf8") : undefined;
    if (before === stub) continue;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, stub);
    wrote(path, before === undefined ? "Wrote" : "Updated");
  }

  const where = workspaceDir === undefined ? undefined : posix(relative(repoRoot, workspaceDir)) || ".";
  const pointer = [
    POINTER_HEADING,
    "",
    where === undefined
      ? "This code's architecture is declared in an Archidocs Workspace kept in another repo."
      : `This repo's architecture is declared in the Archidocs Workspace in \`${where}/\`.`,
    `To edit it, use the \`${SKILL_NAME}\` skill: call the \`get_authoring_guide\` MCP tool, or run \`${runner} guide\` without MCP.`,
    "",
  ].join("\n");
  if (await writePointer(join(repoRoot, "AGENTS.md"), pointer, { create: true })) wrote(join(repoRoot, "AGENTS.md"), "Updated");
  if (await writePointer(join(repoRoot, "CLAUDE.md"), pointer, { create: false })) wrote(join(repoRoot, "CLAUDE.md"), "Updated");

  const mcpPath = workspace ?? where ?? "<path-to-workspace-checkout>";
  out.push(
    "",
    "Register the Archidocs MCP server with your coding agent, started from the repo root:",
    "",
    `  ${runner} mcp --workspace ${mcpPath}`,
    "",
    ...(workspaceDir === undefined ? ["Point --workspace at a local checkout of the Workspace repo, relative to where the coding agent starts the server."] : []),
  );
  return out;
}

const POINTER_HEADING = "## Architecture model";

/**
 * Writes the pointer into AGENTS.md or CLAUDE.md: replaces init's own
 * section (its heading up to the next `## ` heading) in place, so a re-run
 * follows a change of setup, or appends it when the file has none. A file
 * that names the skill outside that section is left alone. Returns whether
 * the file changed.
 */
async function writePointer(path: string, pointer: string, { create }: { create: boolean }): Promise<boolean> {
  const text = existsSync(path) ? await readFile(path, "utf8") : undefined;
  const lines = text?.split("\n") ?? [];
  const start = lines.indexOf(POINTER_HEADING);
  if (text === undefined || start === -1) return appendOnce(path, pointer, (t) => t.includes(SKILL_NAME), { create });
  const next = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  const before = lines.slice(0, start).join("\n");
  const after = next === -1 ? "" : "\n" + lines.slice(next).join("\n");
  const updated = (start === 0 ? "" : before + "\n") + pointer + after;
  if (updated === text) return false;
  await writeFile(path, updated);
  return true;
}

/**
 * Appends `block` to the file unless `present` already finds it there,
 * separating it from what is there by a blank line (one newline for a line
 * list such as `.gitignore`). Returns whether the file changed.
 */
async function appendOnce(path: string, block: string, present: (text: string) => boolean, { create }: { create: boolean }): Promise<boolean> {
  const exists = existsSync(path);
  if (!exists && !create) return false;
  const text = exists ? await readFile(path, "utf8") : "";
  if (present(text)) return false;
  const lineList = !block.includes("\n");
  const body = lineList ? `${block}\n` : block;
  const separator = text === "" ? "" : text.endsWith("\n") ? (lineList ? "" : "\n") : lineList ? "\n" : "\n\n";
  await writeFile(path, text + separator + body);
  return true;
}

const posix = (path: string) => path.split(sep).join("/");
