import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const workflow = parse(readFileSync(new URL("../../.github/workflows/promote.yml", import.meta.url), "utf8"));
const script: string = workflow.jobs.promote.steps.find((s: { name?: string }) => s.name === "Work out the stable version").run;

// A throwaway repo: `main` at v1.4.0, then each entry of `history` is a commit message, or a tag on the commit before it.
function repo(history: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "promote-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir });
  git("init", "-q", "-b", "beta");
  git("commit", "-q", "--allow-empty", "-m", "chore(release): 1.4.0 [skip ci]");
  git("tag", "v1.4.0");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  for (const entry of history) {
    if (/^v\d/.test(entry)) git("tag", entry);
    else git("commit", "-q", "--allow-empty", "-m", entry);
  }
  return dir;
}

// Runs the step in the repo: the version it outputs, or the error it refuses with.
function promote(dir: string): { version?: string; error?: string } {
  const output = join(dir, ".git", "output");
  const run = spawnSync("bash", ["-c", script], { cwd: dir, encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: output } });
  if (run.status !== 0) return { error: run.stdout.match(/::error::(.*)/)?.[1] };
  return { version: readFileSync(output, "utf8").match(/^version=(.*)$/m)?.[1] };
}

describe("the Promote workflow's version step", () => {
  it("promotes the newest beta without its -beta.N", () => {
    expect(promote(repo(["feat: a", "v1.5.0-beta.1", "fix: b", "v1.5.0-beta.2"]))).toEqual({ version: "1.5.0" });
  });

  it.each(["docs: c", "chore(deps): d", "chore(release): 1.5.0-beta.2 [skip ci]", "ci: e\n\nfeat: not a header"])("allows %j after the beta", (message) => {
    expect(promote(repo(["feat: a", "v1.5.0-beta.2", message]))).toEqual({ version: "1.5.0" });
  });

  it.each(["feat: c", "fix(cli): c", "perf: c", "revert: c", 'Revert "feat: a"', "refactor!: c", "docs: c\n\nBREAKING CHANGE: gone"])(
    "refuses when %j comes after the beta",
    (message) => {
      expect(promote(repo(["feat: a", "v1.5.0-beta.1", message])).error).toContain("would release on their own");
    },
  );

  it("refuses when the stable tag already exists", () => {
    expect(promote(repo(["feat: a", "v1.5.0-beta.1", "chore(release): 1.5.0", "v1.5.0"])).error).toContain("v1.5.0 already exists");
  });

  it("refuses with no beta tag", () => {
    expect(promote(repo(["feat: a"])).error).toContain("No vX.Y.Z-beta.N tag");
  });

  it("refuses when main can't fast-forward to beta", () => {
    const dir = repo(["feat: a", "v1.5.0-beta.1"]);
    const stray = execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit-tree", "-m", "fix: on main", "HEAD^{tree}", "-p", "v1.4.0"], { cwd: dir, encoding: "utf8" }).trim();
    execFileSync("git", ["update-ref", "refs/remotes/origin/main", stray], { cwd: dir });
    expect(promote(dir).error).toContain("main is not an ancestor of beta");
  });
});
