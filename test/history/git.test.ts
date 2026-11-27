import { describe, expect, it } from "vitest";
import { firstParentCommitsTouching } from "../../src/history/git.ts";
import { scriptedRepo } from "../support/git-history.ts";

describe("firstParentCommitsTouching", () => {
  it("lists a merge that brings a change under the path, and not a commit outside it", async () => {
    const repo = await scriptedRepo();
    await repo.commit("Base", "2026-01-01T12:00:00Z", { "archidocs/a.yaml": "a: 1\n", "src/x.ts": "1\n" });
    repo.git("switch", "-c", "side");
    await repo.commit("Side edit", "2026-01-02T12:00:00Z", { "archidocs/a.yaml": "a: 2\n" });
    repo.git("switch", "main");
    await repo.commit("Outside only", "2026-01-03T12:00:00Z", { "src/x.ts": "2\n" });
    repo.git("-c", "user.name=Ana Author", "-c", "user.email=ana@example.com", "merge", "--no-ff", "-m", "Merge side", "side");
    await repo.commit("Outside again", "2026-01-04T12:00:00Z", { "src/x.ts": "3\n" });

    const subjects = async (path: string) => (await firstParentCommitsTouching(repo.repoRoot, "main", path)).map((c) => c.subject);
    expect(await subjects("archidocs")).toEqual(["Merge side", "Base"]);
    expect(await subjects("src")).toEqual(["Outside again", "Outside only", "Base"]);
    expect(await subjects("")).toHaveLength(4);
  });

  it("takes spaces and glob characters literally and keeps history of a path gone from the tip", async () => {
    const repo = await scriptedRepo();
    await repo.commit("Add", "2026-01-01T12:00:00Z", { "my ws/[a]/f.yaml": "1\n", "my ws/b/f.yaml": "1\n" });
    await repo.commit("Remove", "2026-01-02T12:00:00Z", { "my ws/[a]/f.yaml": null });
    await repo.commit("Other", "2026-01-03T12:00:00Z", { "my ws/b/f.yaml": "2\n" });

    const subjects = async (path: string) => (await firstParentCommitsTouching(repo.repoRoot, "main", path)).map((c) => c.subject);
    expect(await subjects("my ws/[a]")).toEqual(["Remove", "Add"]);
    expect(await subjects("my ws/*")).toEqual([]);
  });
});
