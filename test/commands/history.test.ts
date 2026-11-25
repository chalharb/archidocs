import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildHistory } from "../../src/commands/index.ts";
import { checkoutAt } from "../../src/workspace/index.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { inWorkspace, scriptedRepo } from "../support/git-history.ts";
import { checkoutOutsideGit } from "./support.ts";

describe("buildHistory", () => {
  it("returns not-in-git outside git", async () => {
    const { checkout } = await checkoutOutsideGit(landscapeWorkspace);

    expect(await buildHistory(checkout)).toEqual({ kind: "not-in-git" });
  });

  it("builds each Revision once: a second run builds nothing", async () => {
    const repo = await scriptedRepo();
    await repo.commit("Model", "2026-01-10T12:00:00Z", inWorkspace(landscapeWorkspace));
    await repo.commit("Add wishlist", "2026-02-10T12:00:00Z", { "archidocs/shop/wishlist.yaml": "services:\n  wishlist:\n    name: Wishlist\n" });
    const checkout = checkoutAt(join(repo.repoRoot, "archidocs"));

    expect(await buildHistory(checkout)).toEqual({ kind: "ok", revisions: 2, built: 2 });
    expect(await buildHistory(checkout)).toEqual({ kind: "ok", revisions: 2, built: 0 });
    expect(await buildHistory(checkout, { since: "2026-02-01" })).toEqual({ kind: "ok", revisions: 1, built: 0 });
  });
});
