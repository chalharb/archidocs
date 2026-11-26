import { describe, expect, it } from "vitest";
import { touching } from "../../src/revisions/index.ts";

/** Newest first, as the index lists them. */
const REVISIONS = [
  { sha: "c", changedIds: ["shop:api", "shop:db"] },
  { sha: "b", changedIds: [] },
  { sha: "a", changedIds: ["shop:web"] },
];

describe("touching", () => {
  it("keeps the Revisions whose changed ids satisfy the matcher, newest first", () => {
    const shas = (matches: (ids: string[]) => boolean) => touching(REVISIONS, matches).map((r) => r.sha);
    expect(shas((ids) => ids.some((i) => i.startsWith("shop:")))).toEqual(["c", "a"]);
    expect(shas((ids) => ids.includes("shop:db"))).toEqual(["c"]);
    expect(shas(() => false)).toEqual([]);
  });

  it("hands the matcher each Revision's changed ids, empty ones included", () => {
    const seen: string[][] = [];
    touching(REVISIONS, (ids) => (seen.push(ids), true));
    expect(seen).toEqual([["shop:api", "shop:db"], [], ["shop:web"]]);
  });
});
