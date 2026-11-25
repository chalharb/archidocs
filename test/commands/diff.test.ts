import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { diff } from "../../src/commands/index.ts";
import { checkoutAt } from "../../src/workspace/index.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { inWorkspace, scriptedRepo } from "../support/git-history.ts";
import { checkoutOutsideGit } from "./support.ts";

/** A repo with the landscape model, then Wishlist added; the working tree also renames Web. */
async function twoCommits() {
  const repo = await scriptedRepo();
  const model = await repo.commit("Model", "2026-01-10T12:00:00Z", inWorkspace(landscapeWorkspace));
  const wishlist = await repo.commit("Add wishlist", "2026-02-10T12:00:00Z", { "archidocs/shop/wishlist.yaml": "services:\n  wishlist:\n    name: Wishlist\n" });
  return { repo, model, wishlist, checkout: checkoutAt(join(repo.repoRoot, "archidocs")) };
}

describe("diff", () => {
  it("returns unknown-point for a ref that names no commit", async () => {
    const { checkout, model } = await twoCommits();

    expect(await diff(checkout, { from: "nope" })).toEqual({ kind: "unknown-point", point: "nope" });
    expect(await diff(checkout, { from: model, to: "nope" })).toEqual({ kind: "unknown-point", point: "nope" });
  });

  it("returns the Changes between two refs", async () => {
    const { checkout, model, wishlist } = await twoCommits();

    const result = await diff(checkout, { from: model, to: "HEAD" });

    expect(result).toMatchObject({ kind: "ok", from: { point: model, commit: model }, to: { point: "HEAD", commit: wishlist } });
    expect(result.kind === "ok" && result.changes.map((c) => [c.type, c.id])).toEqual([["added", "shop:wishlist"]]);
  });

  it("diffs a ref against the working tree when no second point is given", async () => {
    const { checkout, repo } = await twoCommits();
    await writeFile(join(repo.repoRoot, "archidocs/shop/gifts.yaml"), "services:\n  gifts:\n    name: Gifts\n");

    const result = await diff(checkout, { from: "HEAD" });

    expect(result).toMatchObject({ kind: "ok", to: { point: "working tree", commit: null } });
    expect(result.kind === "ok" && result.changes.map((c) => [c.type, c.id])).toEqual([["added", "shop:gifts"]]);
  });

  it("returns not-in-git outside git", async () => {
    const { checkout } = await checkoutOutsideGit(landscapeWorkspace);

    expect(await diff(checkout, { from: "HEAD" })).toEqual({ kind: "not-in-git" });
  });
});
