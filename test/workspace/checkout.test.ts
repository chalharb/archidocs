import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkoutAt, findCheckout } from "../../src/workspace/index.ts";
import { validWorkspace } from "../support/fixtures.ts";
import { writeWorkspace } from "../support/workspace.ts";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], { cwd, encoding: "utf8" }).trim();

describe("Checkout", () => {
  it("outside git has no repo, is named after its root and loads", async () => {
    const { repoRoot, root } = await writeWorkspace(validWorkspace);
    await rm(join(repoRoot, ".git"), { recursive: true });
    const checkout = checkoutAt(root);

    expect(checkout.root).toBe(root);
    expect(await checkout.repo()).toBeUndefined();
    expect(await checkout.name()).toBe("archidocs");
    expect(await checkout.head()).toEqual({ commit: null, builtAt: null });
    const { bundle, issues } = await checkout.load();
    expect(issues).toEqual([]);
    expect(bundle.projects.map((p) => p.folder)).toEqual(["payments", "shop"]);
  });

  it("in git is found from a subfolder and from the repo root, in its archidocs/ folder", async () => {
    const { repoRoot, root } = await writeWorkspace(validWorkspace);
    const fromSub = await findCheckout(join(root, "shop"));
    const fromRepo = await findCheckout(repoRoot);

    expect(fromSub?.root).toBe(root);
    expect(fromRepo?.root).toBe(root);
    const repo = await fromRepo!.repo();
    expect(repo).toEqual({ realRoot: await realpath(root), repoRoot: await realpath(repoRoot), history: { repoRoot: await realpath(repoRoot), workspacePath: "archidocs" } });
    expect(await fromRepo!.name()).toBe(basename(repoRoot));
    const { bundle, issues } = await fromSub!.load();
    expect(issues).toEqual([]);
    expect(bundle.projects.map((p) => p.folder)).toEqual(["archidocs/payments", "archidocs/shop"]);
  });

  it("under a symlinked folder resolves the repo but shows the root as given, with the same Bundle paths", async () => {
    const { repoRoot, root } = await writeWorkspace(validWorkspace);
    const link = join(await mkdtemp(join(tmpdir(), "archidocs-link-")), "repo");
    await symlink(repoRoot, link);
    const linked = (await findCheckout(join(link, "archidocs")))!;

    expect(linked.root).toBe(join(link, "archidocs"));
    const repo = (await linked.repo())!;
    expect(repo.realRoot).toBe(await realpath(root));
    expect(repo.repoRoot).toBe(await realpath(repoRoot));
    expect((await linked.load()).bundle).toEqual((await checkoutAt(await realpath(root)).load()).bundle);
    expect((await linked.load()).bundle.elements[0]!.source.file).toMatch(/^archidocs\//);
  });

  it("reads HEAD on every call", async () => {
    const { repoRoot, root } = await writeWorkspace(validWorkspace);
    const checkout = checkoutAt(root);
    git(repoRoot, "add", ".");
    git(repoRoot, "commit", "--quiet", "-m", "First");
    const first = await checkout.head();
    git(repoRoot, "commit", "--quiet", "--allow-empty", "-m", "Second");
    const second = await checkout.head();

    expect(first.commit).toBe(git(repoRoot, "rev-parse", "HEAD~1"));
    expect(second.commit).toBe(git(repoRoot, "rev-parse", "HEAD"));
    expect((await checkout.load()).bundle.commit).toBe(second.commit);
  });

  it("fingerprints only Workspace files", async () => {
    const { root } = await writeWorkspace({ ...validWorkspace, "notes.txt": "a", ".hidden/x.yaml": "a: 1" });
    const checkout = checkoutAt(root);
    const files = await checkout.fingerprint();
    expect(files).toContain(join(root, "workspace.yaml"));
    expect(files).not.toContain("notes.txt");
    expect(files).not.toContain(".hidden");
  });

  it("is not found where there is no Workspace", async () => {
    expect(await findCheckout(await mkdtemp(join(tmpdir(), "archidocs-empty-")))).toBeUndefined();
  });
});
