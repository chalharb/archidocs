import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { archidocs } from "../support/cli.ts";
import { landscapeWorkspace, relationshipWorkspace } from "../support/fixtures.ts";
import { inWorkspace, scriptedRepo } from "../support/git-history.ts";

const adr = (status: string, title: string) => `---\nstatus: ${status}\ndate: 2026-03-01\nelements: [cart]\n---\n\n# ${title}\n\nWe decided.\n`;

/** The landscape fixture with a Saved View and an ADR, so every item kind is present. */
const v1 = inWorkspace({
  ...landscapeWorkspace,
  "shop/views.yaml": "views:\n  structural:\n    overview:\n      title: Overview\n      level: c2\n",
  "shop/adr/0001-use-kafka.md": adr("proposed", "Use Kafka"),
});

/** Every item kind changed once against v1. */
const v2 = {
  ...v1,
  "archidocs/workspace.yaml": landscapeWorkspace["workspace.yaml"]!.replace("name: Platform", "name: Platform engineering") + "  staging:\n    name: Staging\n",
  "archidocs/platform/project.yaml": "id: platform\nname: Platform tooling\nowner: platform-team\n",
  "archidocs/shop/web.yaml": relationshipWorkspace["shop/web.yaml"]!.replace("name: Web", "name: Web shop"),
  "archidocs/shop/systems.yaml": relationshipWorkspace["shop/systems.yaml"]!.replace("Reads and writes carts", "Stores carts"),
  "archidocs/platform/targets.yaml": landscapeWorkspace["platform/targets.yaml"]!.replace("name: EKS prod", "name: EKS production"),
  "archidocs/payments/deployments.yaml": "deployments:\n  - { service: payments-api, environment: prod, target: platform:eks-prod, url: https://pay.example.com }\n",
  "archidocs/shop/views.yaml": "views:\n  structural:\n    overview:\n      title: Shop overview\n      level: c2\n",
  "archidocs/shop/adr/0001-use-kafka.md": adr("accepted", "Use Kafka"),
};

describe("archidocs diff", () => {
  it("prints the Changes of every item kind between two refs as JSON", async () => {
    const repo = await scriptedRepo();
    const from = await repo.commit("First model", "2026-01-10T12:00:00Z", v1);
    const to = await repo.commit("Second model", "2026-02-10T12:00:00Z", v2);
    repo.git("tag", "v1", from);

    const { code, stdout, stderr } = await archidocs(repo.repoRoot, "diff", "v1", "main", "--format", "json");

    expect(stderr).toBe("");
    expect(code).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.from).toEqual({ point: "v1", commit: from });
    expect(result.to).toEqual({ point: "main", commit: to });
    expect(result.counts).toEqual({ added: 1, removed: 0, changed: 8 });
    expect(result.changes.map((c: { type: string; kind: string; id: string; fields: string[] }) => [c.type, c.kind, c.id, c.fields])).toEqual([
      ["changed", "team", "platform-team", ["name"]],
      ["added", "environment", "staging", []],
      ["changed", "project", "platform", ["name"]],
      ["changed", "element", "shop:web", ["name"]],
      ["changed", "relationship", "shop:cart -> shop:cart-db", ["description"]],
      ["changed", "target", "platform:eks-prod", ["name"]],
      ["changed", "deployment", "payments:payments-api in prod on platform:eks-prod", ["url"]],
      ["changed", "view", "shop:overview", ["title"]],
      ["changed", "adr", "shop:0001", ["status", "effectiveStatus"]],
    ]);
  });

  it("prints an Owner changed through the Project's default as text", async () => {
    const repo = await scriptedRepo();
    await repo.commit("Model", "2026-01-10T12:00:00Z", inWorkspace(landscapeWorkspace));
    await repo.commit("Hand payments to platform", "2026-02-10T12:00:00Z", { "archidocs/payments/project.yaml": "id: payments\nname: Payments\nowner: platform-team\n" });

    const { code, stdout } = await archidocs(repo.repoRoot, "diff", "main~1", "main");

    expect(code).toBe(0);
    expect(stdout).toBe(
      [
        `Changes from main~1 (${repo.git("rev-parse", "--short=7", "main~1")}) to main (${repo.git("rev-parse", "--short=7", "main")}): 0 added, 0 removed, 5 changed`,
        "",
        "~ Project payments",
        '    owner: "payments-team" → "platform-team"',
        "~ Element payments:charges",
        '    owner: "payments-team" → "platform-team"',
        "~ Element payments:payments",
        '    owner: "payments-team" → "platform-team"',
        "~ Element payments:payments-api",
        '    owner: "payments-team" → "platform-team"',
        "~ Deployment payments:payments-api in prod on platform:eks-prod",
        '    owner: "payments-team" → "platform-team"',
        "",
      ].join("\n"),
    );
  });

  it("prints a Relationship it can't match as removed plus added, as markdown", async () => {
    // Two Relationships on one pair: "Lists" is unchanged, "Reads" changes technology, so it matches neither by pair nor by shape.
    const twoEdges = (technology: string) =>
      `services:\n  search:\n    name: Search\n    relationships:\n      - { to: cart, description: Reads, technology: ${technology} }\n      - { to: cart, description: Lists, technology: HTTPS }\n`;
    const repo = await scriptedRepo();
    const from = await repo.commit("Model", "2026-01-10T12:00:00Z", inWorkspace({ ...relationshipWorkspace, "shop/search.yaml": twoEdges("HTTPS") }));
    await repo.commit("Move to gRPC", "2026-02-10T12:00:00Z", inWorkspace({ "shop/search.yaml": twoEdges("gRPC") }));

    const { code, stdout } = await archidocs(repo.repoRoot, "diff", from, "HEAD", "--format", "markdown");

    expect(code).toBe(0);
    expect(stdout).toBe(
      [
        `### Model changes \`${from.slice(0, 7)}\` → \`HEAD (${repo.git("rev-parse", "--short=7", "HEAD")})\``,
        "",
        "1 added, 1 removed, 0 changed.",
        "",
        "| Change | Kind | Id | Fields |",
        "| --- | --- | --- | --- |",
        "| removed | Relationship | `shop:search -> shop:cart` |  |",
        "| added | Relationship | `shop:search -> shop:cart` |  |",
        "",
      ].join("\n"),
    );
  });

  it("resolves dates to the last default-branch commit at or before them, and diffs to the working tree by default", async () => {
    const repo = await scriptedRepo();
    const january = await repo.commit("Model", "2026-01-10T12:00:00Z", inWorkspace(landscapeWorkspace));
    const february = await repo.commit("Rename web", "2026-02-10T12:00:00Z", { "archidocs/shop/web.yaml": relationshipWorkspace["shop/web.yaml"]!.replace("name: Web", "name: Web shop") });
    await writeFile(join(repo.repoRoot, "archidocs/shop/web.yaml"), relationshipWorkspace["shop/web.yaml"]!.replace("name: Web", "name: Storefront"));

    const byDate = JSON.parse((await archidocs(repo.repoRoot, "diff", "2026-01-31", "2026-02-10", "--format", "json")).stdout);
    const toWorkingTree = JSON.parse((await archidocs(join(repo.repoRoot, "archidocs"), "diff", "HEAD", "--format", "json")).stdout);
    const tooEarly = await archidocs(repo.repoRoot, "diff", "2025-12-31");

    expect([byDate.from.commit, byDate.to.commit]).toEqual([january, february]);
    expect(byDate.changes.map((c: { id: string }) => c.id)).toEqual(["shop:web"]);
    expect(toWorkingTree.to).toEqual({ point: "working tree", commit: null });
    expect(toWorkingTree.changes.map((c: { after: { name: string } }) => c.after.name)).toEqual(["Storefront"]);
    expect(tooEarly.code).toBe(2);
    expect(tooEarly.stderr).toContain('Unknown ref or date "2025-12-31"');
  });

  it("rebuilds a cached Bundle from an older schemaVersion instead of comparing it raw", async () => {
    const repo = await scriptedRepo();
    const from = await repo.commit("Model", "2026-01-10T12:00:00Z", inWorkspace(landscapeWorkspace));
    await repo.commit("Rename web", "2026-02-10T12:00:00Z", { "archidocs/shop/web.yaml": relationshipWorkspace["shop/web.yaml"]!.replace("name: Web", "name: Web shop") });
    const first = await archidocs(repo.repoRoot, "diff", from, "HEAD");
    const cached = join(repo.repoRoot, ".archidocs/cache/bundles", `${from}.json`);
    await writeFile(cached, JSON.stringify({ schemaVersion: 0, commit: from, elements: [] }));

    const second = await archidocs(repo.repoRoot, "diff", from, "HEAD");

    expect(second.stdout).toBe(first.stdout);
    expect(JSON.parse(await readFile(cached, "utf8")).schemaVersion).toBe(1);
  });
});

describe("archidocs history build", () => {
  /** A repo whose second commit touches only files outside the Workspace root, and whose fourth merges a branch. */
  async function repoWithHistory() {
    const repo = await scriptedRepo();
    const first = await repo.commit("Model", "2026-01-10T12:00:00Z", inWorkspace(landscapeWorkspace));
    await repo.commit("Docs only", "2026-01-20T12:00:00Z", { "README.md": "# Shop\n" });
    const third = await repo.commit("Rename web", "2026-02-10T12:00:00Z", { "archidocs/shop/web.yaml": relationshipWorkspace["shop/web.yaml"]!.replace("name: Web", "name: Web shop") });
    repo.git("checkout", "--quiet", "-b", "feature");
    await repo.commit("Add wishlist", "2026-02-15T12:00:00Z", { "archidocs/shop/wishlist.yaml": "services:\n  wishlist:\n    name: Wishlist\n" });
    repo.git("checkout", "--quiet", "main");
    execMerge(repo);
    const merge = repo.git("rev-parse", "HEAD");
    repo.git("tag", "v1", third);
    return { repo, first, third, merge };
  }

  const execMerge = (repo: Awaited<ReturnType<typeof scriptedRepo>>) =>
    repo.git("-c", "user.name=Ana Author", "-c", "user.email=ana@example.com", "merge", "--quiet", "--no-ff", "-m", "Merge feature", "feature");

  it("caches a Bundle and an index entry for each Revision, skipping commits outside the Workspace root and branch commits", async () => {
    const { repo, first, third, merge } = await repoWithHistory();

    const { code, stdout } = await archidocs(repo.repoRoot, "history", "build");

    expect(code).toBe(0);
    expect(stdout).toBe("Built 3 Revisions; 0 of 3 already built.\n");
    const index = JSON.parse(await readFile(join(repo.repoRoot, ".archidocs/cache/bundles/index.json"), "utf8"));
    expect(index.revisions.map((r: { sha: string; subject: string; tags: string[]; counts: unknown; changedIds: string[] }) => [r.sha, r.subject, r.tags, r.counts, r.changedIds])).toEqual([
      [merge, "Merge feature", [], { added: 1, removed: 0, changed: 0 }, ["shop:wishlist"]],
      [third, "Rename web", ["v1"], { added: 0, removed: 0, changed: 1 }, ["shop:web"]],
      [first, "Model", [], { added: 30, removed: 0, changed: 0 }, expect.arrayContaining(["shop:web", "payments:charges", "platform:eks-prod"])],
    ]);
    expect(index.revisions[1]).toMatchObject({ date: "2026-02-10T12:00:00Z", author: "Ana Author", bundle: true });
    const bundle = JSON.parse(await readFile(join(repo.repoRoot, ".archidocs/cache/bundles", `${third}.json`), "utf8"));
    expect(bundle).toMatchObject({ schemaVersion: 1, commit: third, builtAt: "2026-02-10T12:00:00Z" });
  });

  it("builds nothing the second time", async () => {
    const { repo, third } = await repoWithHistory();
    await archidocs(repo.repoRoot, "history", "build");
    const files = [".archidocs/cache/bundles/index.json", `.archidocs/cache/bundles/${third}.json`].map((f) => join(repo.repoRoot, f));
    const before = await Promise.all(files.map(async (f) => (await stat(f)).mtimeMs));

    const { stdout } = await archidocs(repo.repoRoot, "history", "build");

    expect(stdout).toBe("Built 0 Revisions; 3 of 3 already built.\n");
    expect(await Promise.all(files.map(async (f) => (await stat(f)).mtimeMs))).toEqual(before);
  });

  it("builds only Revisions at or after --since", async () => {
    const { repo } = await repoWithHistory();

    const byDate = await archidocs(repo.repoRoot, "history", "build", "--since", "2026-02-01");
    const byRef = await archidocs(repo.repoRoot, "history", "build", "--since", "v1");

    expect(byDate.stdout).toBe("Built 2 Revisions; 0 of 2 already built.\n");
    expect(byRef.stdout).toBe("Built 0 Revisions; 2 of 2 already built.\n");
  });
});
